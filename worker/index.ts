export interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // /api 配下のみ Workers 側で処理する
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url)
    }

    // それ以外は静的アセット(ビルド済みReactアプリ)を返す
    return env.ASSETS.fetch(request)
  }
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  // GET /api/categories 一覧取得(type=income|expense でフィルタ可能)
  if (url.pathname === '/api/categories' && request.method === 'GET') {
    const type = url.searchParams.get('type')
    const stmt = type
      ? env.DB.prepare('SELECT * FROM categories WHERE type = ? ORDER BY sort_order').bind(type)
      : env.DB.prepare('SELECT * FROM categories ORDER BY sort_order')
    const { results } = await stmt.all()
    return Response.json(results)
  }

  // GET /api/scopes 一覧取得
  if (url.pathname === '/api/scopes' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM scopes ORDER BY sort_order'
    ).all()
    return Response.json(results)
  }

  // GET /api/payment_methods 一覧取得
  if (url.pathname === '/api/payment_methods' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM payment_methods ORDER BY sort_order'
    ).all()
    return Response.json(results)
  }

  // POST /api/categories 新規追加(入力画面からのクイック追加、メニュー画面の管理どちらからも利用)
  if (url.pathname === '/api/categories' && request.method === 'POST') {
    const body = await request.json<{
      name: string
      type: string
      icon: string | null
      color: string
    }>()

    const errors: string[] = []
    if (!body.name || body.name.trim() === '') errors.push('name は必須です')
    if (body.type !== 'income' && body.type !== 'expense') {
      errors.push('type は income または expense を指定してください')
    }
    if (!body.color) errors.push('color は必須です')
    if (errors.length > 0) {
      return Response.json({ errors }, { status: 400 })
    }

    // 既存の最大sort_orderの次に追加(同じtype内で末尾に配置)
    const maxRow = await env.DB.prepare(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories WHERE type = ?'
    )
      .bind(body.type)
      .first<{ max_order: number }>()

    const result = await env.DB.prepare(
      `INSERT INTO categories (name, type, icon, color, sort_order, is_default)
       VALUES (?, ?, ?, ?, ?, 0)`
    )
      .bind(body.name.trim(), body.type, body.icon ?? null, body.color, (maxRow?.max_order ?? 0) + 1)
      .run()

    return Response.json({ id: result.meta.last_row_id }, { status: 201 })
  }

  // GET /api/transactions?start=YYYY-MM-DD&end=YYYY-MM-DD 期間内の一覧取得(カテゴリ等の表示名を結合)
  if (url.pathname === '/api/transactions' && request.method === 'GET') {
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')
    if (!start || !end) {
      return Response.json({ errors: ['start, end は必須です'] }, { status: 400 })
    }
    const { results } = await env.DB.prepare(
      `SELECT
        t.*,
        c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
        s.name AS scope_name,
        p.name AS payment_method_name
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       JOIN scopes s ON s.id = t.scope_id
       LEFT JOIN payment_methods p ON p.id = t.payment_method_id
       WHERE t.transaction_date BETWEEN ? AND ?
       ORDER BY t.transaction_date ASC, t.id ASC`
    )
      .bind(start, end)
      .all()
    return Response.json(results)
  }

  // PUT /api/transactions/:id 更新
  const transactionIdMatch = url.pathname.match(/^\/api\/transactions\/(\d+)$/)
  if (transactionIdMatch && request.method === 'PUT') {
    const id = Number(transactionIdMatch[1])
    const body = await request.json<{
      type: string
      amount: number
      category_id: number
      scope_id: number
      payment_method_id: number | null
      transaction_date: string
      memo: string | null
    }>()

    const errors: string[] = []
    if (body.type !== 'income' && body.type !== 'expense') {
      errors.push('type は income または expense を指定してください')
    }
    if (typeof body.amount !== 'number' || !(body.amount > 0)) {
      errors.push('amount は0より大きい数値を指定してください')
    }
    if (!body.category_id) errors.push('category_id は必須です')
    if (!body.scope_id) errors.push('scope_id は必須です')
    if (!body.transaction_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.transaction_date)) {
      errors.push('transaction_date は YYYY-MM-DD 形式で指定してください')
    }
    if (errors.length > 0) {
      return Response.json({ errors }, { status: 400 })
    }

    await env.DB.prepare(
      `UPDATE transactions SET
        type = ?, amount = ?, category_id = ?, scope_id = ?,
        payment_method_id = ?, transaction_date = ?, memo = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(
        body.type,
        body.amount,
        body.category_id,
        body.scope_id,
        body.payment_method_id ?? null,
        body.transaction_date,
        body.memo ?? null,
        id
      )
      .run()

    return Response.json({ id })
  }

  // DELETE /api/transactions/:id 削除
  if (transactionIdMatch && request.method === 'DELETE') {
    const id = Number(transactionIdMatch[1])
    await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run()
    return Response.json({ id })
  }

  // POST /api/transactions 新規登録
  if (url.pathname === '/api/transactions' && request.method === 'POST') {
    const body = await request.json<{
      type: string
      amount: number
      category_id: number
      scope_id: number
      payment_method_id: number | null
      transaction_date: string
      memo: string | null
    }>()

    // サーバー側バリデーション(必須項目・値の妥当性チェック)
    const errors: string[] = []
    if (body.type !== 'income' && body.type !== 'expense') {
      errors.push('type は income または expense を指定してください')
    }
    if (typeof body.amount !== 'number' || !(body.amount > 0)) {
      errors.push('amount は0より大きい数値を指定してください')
    }
    if (!body.category_id) errors.push('category_id は必須です')
    if (!body.scope_id) errors.push('scope_id は必須です')
    if (!body.transaction_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.transaction_date)) {
      errors.push('transaction_date は YYYY-MM-DD 形式で指定してください')
    }
    if (errors.length > 0) {
      return Response.json({ errors }, { status: 400 })
    }

    const result = await env.DB.prepare(
      `INSERT INTO transactions
        (type, amount, category_id, scope_id, payment_method_id, transaction_date, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        body.type,
        body.amount,
        body.category_id,
        body.scope_id,
        body.payment_method_id ?? null,
        body.transaction_date,
        body.memo ?? null
      )
      .run()

    return Response.json({ id: result.meta.last_row_id }, { status: 201 })
  }

  // 各エンドポイント(budgets, レポート集計等)は該当画面の実装時に順次追加してください
  return new Response('Not Found', { status: 404 })
}
