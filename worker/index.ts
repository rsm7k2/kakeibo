import { generateDueOccurrences, previewUpcomingDates } from './fixedCost'

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
  },

  // 固定費ルールの日次自動生成(Cloudflare Cron Trigger, wrangler.tomlの[triggers]参照)
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await generateDueOccurrences(env)
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

  // POST /api/scopes 新規追加(メニュー画面)
  if (url.pathname === '/api/scopes' && request.method === 'POST') {
    const body = await request.json<{ name: string }>()
    if (!body.name || body.name.trim() === '') {
      return Response.json({ errors: ['name は必須です'] }, { status: 400 })
    }
    const maxRow = await env.DB.prepare(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM scopes'
    ).first<{ max_order: number }>()
    const result = await env.DB.prepare(
      'INSERT INTO scopes (name, sort_order, is_default) VALUES (?, ?, 0)'
    )
      .bind(body.name.trim(), (maxRow?.max_order ?? 0) + 1)
      .run()
    return Response.json({ id: result.meta.last_row_id }, { status: 201 })
  }

  // PUT /api/scopes/reorder 並び替え(idsの並び順どおりにsort_orderを振り直す)
  if (url.pathname === '/api/scopes/reorder' && request.method === 'PUT') {
    const body = await request.json<{ ids: number[] }>()
    if (!Array.isArray(body.ids)) {
      return Response.json({ errors: ['ids は配列で指定してください'] }, { status: 400 })
    }
    await env.DB.batch(
      body.ids.map((id, i) =>
        env.DB.prepare('UPDATE scopes SET sort_order = ? WHERE id = ?').bind(i + 1, id)
      )
    )
    return Response.json({ ok: true })
  }

  // PUT /api/scopes/:id 編集
  const scopeIdMatch = url.pathname.match(/^\/api\/scopes\/(\d+)$/)
  if (scopeIdMatch && request.method === 'PUT') {
    const id = Number(scopeIdMatch[1])
    const body = await request.json<{ name: string }>()
    if (!body.name || body.name.trim() === '') {
      return Response.json({ errors: ['name は必須です'] }, { status: 400 })
    }
    await env.DB.prepare('UPDATE scopes SET name = ? WHERE id = ?')
      .bind(body.name.trim(), id)
      .run()
    return Response.json({ id })
  }

  // DELETE /api/scopes/:id 削除(収支データ・予算で使用中の場合は削除不可)
  if (scopeIdMatch && request.method === 'DELETE') {
    const id = Number(scopeIdMatch[1])
    const txCount = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM transactions WHERE scope_id = ?'
    )
      .bind(id)
      .first<{ c: number }>()
    const budgetCount = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM budgets WHERE scope_id = ?'
    )
      .bind(id)
      .first<{ c: number }>()
    if ((txCount?.c ?? 0) > 0 || (budgetCount?.c ?? 0) > 0) {
      return Response.json(
        { errors: ['この範囲は収支データまたは予算で使用中のため削除できません'] },
        { status: 400 }
      )
    }
    await env.DB.prepare('DELETE FROM scopes WHERE id = ?').bind(id).run()
    return Response.json({ id })
  }

  // GET /api/payment_methods 一覧取得
  if (url.pathname === '/api/payment_methods' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM payment_methods ORDER BY sort_order'
    ).all()
    return Response.json(results)
  }

  // POST /api/payment_methods 新規追加(メニュー画面)
  if (url.pathname === '/api/payment_methods' && request.method === 'POST') {
    const body = await request.json<{ name: string; icon: string | null }>()
    if (!body.name || body.name.trim() === '') {
      return Response.json({ errors: ['name は必須です'] }, { status: 400 })
    }
    const maxRow = await env.DB.prepare(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM payment_methods'
    ).first<{ max_order: number }>()
    const result = await env.DB.prepare(
      'INSERT INTO payment_methods (name, icon, sort_order, is_default) VALUES (?, ?, ?, 0)'
    )
      .bind(body.name.trim(), body.icon ?? null, (maxRow?.max_order ?? 0) + 1)
      .run()
    return Response.json({ id: result.meta.last_row_id }, { status: 201 })
  }

  // PUT /api/payment_methods/reorder 並び替え
  if (url.pathname === '/api/payment_methods/reorder' && request.method === 'PUT') {
    const body = await request.json<{ ids: number[] }>()
    if (!Array.isArray(body.ids)) {
      return Response.json({ errors: ['ids は配列で指定してください'] }, { status: 400 })
    }
    await env.DB.batch(
      body.ids.map((id, i) =>
        env.DB.prepare('UPDATE payment_methods SET sort_order = ? WHERE id = ?').bind(i + 1, id)
      )
    )
    return Response.json({ ok: true })
  }

  // PUT /api/payment_methods/:id 編集
  const paymentMethodIdMatch = url.pathname.match(/^\/api\/payment_methods\/(\d+)$/)
  if (paymentMethodIdMatch && request.method === 'PUT') {
    const id = Number(paymentMethodIdMatch[1])
    const body = await request.json<{ name: string; icon: string | null }>()
    if (!body.name || body.name.trim() === '') {
      return Response.json({ errors: ['name は必須です'] }, { status: 400 })
    }
    await env.DB.prepare('UPDATE payment_methods SET name = ?, icon = ? WHERE id = ?')
      .bind(body.name.trim(), body.icon ?? null, id)
      .run()
    return Response.json({ id })
  }

  // DELETE /api/payment_methods/:id 削除(収支データで使用中の場合は削除不可)
  if (paymentMethodIdMatch && request.method === 'DELETE') {
    const id = Number(paymentMethodIdMatch[1])
    const txCount = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM transactions WHERE payment_method_id = ?'
    )
      .bind(id)
      .first<{ c: number }>()
    if ((txCount?.c ?? 0) > 0) {
      return Response.json(
        { errors: ['この支払い方法は収支データで使用中のため削除できません'] },
        { status: 400 }
      )
    }
    await env.DB.prepare('DELETE FROM payment_methods WHERE id = ?').bind(id).run()
    return Response.json({ id })
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

  // PUT /api/categories/reorder 並び替え(type内でidsの並び順どおりにsort_orderを振り直す)
  if (url.pathname === '/api/categories/reorder' && request.method === 'PUT') {
    const body = await request.json<{ type: string; ids: number[] }>()
    if (body.type !== 'income' && body.type !== 'expense') {
      return Response.json({ errors: ['type は income または expense を指定してください'] }, { status: 400 })
    }
    if (!Array.isArray(body.ids)) {
      return Response.json({ errors: ['ids は配列で指定してください'] }, { status: 400 })
    }
    await env.DB.batch(
      body.ids.map((id, i) =>
        env.DB.prepare('UPDATE categories SET sort_order = ? WHERE id = ? AND type = ?').bind(
          i + 1,
          id,
          body.type
        )
      )
    )
    return Response.json({ ok: true })
  }

  // PUT /api/categories/:id 編集(name, icon, color のみ。typeは既存の収支データとの整合性のため変更不可)
  const categoryIdMatch = url.pathname.match(/^\/api\/categories\/(\d+)$/)
  if (categoryIdMatch && request.method === 'PUT') {
    const id = Number(categoryIdMatch[1])
    const body = await request.json<{ name: string; icon: string | null; color: string }>()

    const errors: string[] = []
    if (!body.name || body.name.trim() === '') errors.push('name は必須です')
    if (!body.color) errors.push('color は必須です')
    if (errors.length > 0) {
      return Response.json({ errors }, { status: 400 })
    }

    await env.DB.prepare('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?')
      .bind(body.name.trim(), body.icon ?? null, body.color, id)
      .run()
    return Response.json({ id })
  }

  // DELETE /api/categories/:id 削除(収支データ・予算で使用中の場合は削除不可)
  if (categoryIdMatch && request.method === 'DELETE') {
    const id = Number(categoryIdMatch[1])
    const txCount = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM transactions WHERE category_id = ?'
    )
      .bind(id)
      .first<{ c: number }>()
    const budgetCount = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM budgets WHERE category_id = ?'
    )
      .bind(id)
      .first<{ c: number }>()
    if ((txCount?.c ?? 0) > 0 || (budgetCount?.c ?? 0) > 0) {
      return Response.json(
        { errors: ['このカテゴリは収支データまたは予算で使用中のため削除できません'] },
        { status: 400 }
      )
    }
    await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
    return Response.json({ id })
  }

  // GET /api/transactions?start=YYYY-MM-DD&end=YYYY-MM-DD&scope_id=N(任意) 期間内の一覧取得(カテゴリ等の表示名を結合)
  if (url.pathname === '/api/transactions' && request.method === 'GET') {
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')
    const scopeId = url.searchParams.get('scope_id')
    if (!start || !end) {
      return Response.json({ errors: ['start, end は必須です'] }, { status: 400 })
    }
    const stmt = scopeId
      ? env.DB.prepare(
          `SELECT
            t.*,
            c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
            s.name AS scope_name,
            p.name AS payment_method_name
           FROM transactions t
           JOIN categories c ON c.id = t.category_id
           JOIN scopes s ON s.id = t.scope_id
           LEFT JOIN payment_methods p ON p.id = t.payment_method_id
           WHERE t.transaction_date BETWEEN ? AND ? AND t.scope_id = ?
           ORDER BY t.transaction_date ASC, t.id ASC`
        ).bind(start, end, Number(scopeId))
      : env.DB.prepare(
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
        ).bind(start, end)
    const { results } = await stmt.all()
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
      is_fixed_cost?: boolean
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
        payment_method_id = ?, transaction_date = ?, memo = ?, is_fixed_cost = ?,
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
        body.is_fixed_cost ? 1 : 0,
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
      is_fixed_cost?: boolean
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
        (type, amount, category_id, scope_id, payment_method_id, transaction_date, memo, is_fixed_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        body.type,
        body.amount,
        body.category_id,
        body.scope_id,
        body.payment_method_id ?? null,
        body.transaction_date,
        body.memo ?? null,
        body.is_fixed_cost ? 1 : 0
      )
      .run()

    return Response.json({ id: result.meta.last_row_id }, { status: 201 })
  }

  // POST /api/transactions/bulk CSV取込み確定時の一括登録
  // (カテゴリ名→id・範囲名→id の解決はフロント側のプレビュー時に完了させ、
  //  ここでは category_id・scope_id が解決済みの行を受け取るだけにする)
  if (url.pathname === '/api/transactions/bulk' && request.method === 'POST') {
    const body = await request.json<{
      rows: Array<{
        type: string
        amount: number
        category_id: number
        scope_id: number
        transaction_date: string
        memo: string | null
        is_fixed_cost?: boolean
      }>
    }>()

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return Response.json({ errors: ['rows は1件以上指定してください'] }, { status: 400 })
    }

    const BATCH_SIZE = 100
    let inserted = 0
    for (let i = 0; i < body.rows.length; i += BATCH_SIZE) {
      const chunk = body.rows.slice(i, i + BATCH_SIZE)
      await env.DB.batch(
        chunk.map((row) =>
          env.DB.prepare(
            `INSERT INTO transactions
              (type, amount, category_id, scope_id, payment_method_id, transaction_date, memo, is_fixed_cost)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`
          ).bind(
            row.type,
            row.amount,
            row.category_id,
            row.scope_id,
            row.transaction_date,
            row.memo ?? null,
            row.is_fixed_cost ? 1 : 0
          )
        )
      )
      inserted += chunk.length
    }

    return Response.json({ inserted }, { status: 201 })
  }

  // GET /api/budgets?year_month=YYYY-MM&scope_id=N 指定した月・範囲の予算一覧
  // (category_id が NULL の行 = その範囲全体の予算)
  if (url.pathname === '/api/budgets' && request.method === 'GET') {
    const yearMonth = url.searchParams.get('year_month')
    const scopeId = url.searchParams.get('scope_id')
    if (!yearMonth || !scopeId) {
      return Response.json({ errors: ['year_month, scope_id は必須です'] }, { status: 400 })
    }
    const { results } = await env.DB.prepare(
      'SELECT * FROM budgets WHERE year_month = ? AND scope_id = ?'
    )
      .bind(yearMonth, Number(scopeId))
      .all()
    return Response.json(results)
  }

  // PUT /api/budgets 予算の登録・更新(year_month × scope_id × category_id で1件に定まる)
  // category_id が null の場合は「範囲全体の予算」を表す。
  // SQLiteのUNIQUE制約はNULL同士を区別してしまうため、category_id が null のケースは
  // ON CONFLICTではなく事前のSELECTで存在確認してから INSERT/UPDATE を出し分ける。
  if (url.pathname === '/api/budgets' && request.method === 'PUT') {
    const body = await request.json<{
      year_month: string
      scope_id: number
      category_id: number | null
      amount: number
    }>()

    const errors: string[] = []
    if (!body.year_month || !/^\d{4}-\d{2}$/.test(body.year_month)) {
      errors.push('year_month は YYYY-MM 形式で指定してください')
    }
    if (!body.scope_id) errors.push('scope_id は必須です')
    if (typeof body.amount !== 'number' || body.amount < 0) {
      errors.push('amount は0以上の数値を指定してください')
    }
    if (errors.length > 0) {
      return Response.json({ errors }, { status: 400 })
    }

    if (body.category_id === null) {
      const existing = await env.DB.prepare(
        'SELECT id FROM budgets WHERE year_month = ? AND scope_id = ? AND category_id IS NULL'
      )
        .bind(body.year_month, body.scope_id)
        .first<{ id: number }>()

      if (existing) {
        await env.DB.prepare(
          `UPDATE budgets SET amount = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(body.amount, existing.id)
          .run()
        return Response.json({ id: existing.id })
      }

      const result = await env.DB.prepare(
        `INSERT INTO budgets (year_month, scope_id, category_id, amount) VALUES (?, ?, NULL, ?)`
      )
        .bind(body.year_month, body.scope_id, body.amount)
        .run()
      return Response.json({ id: result.meta.last_row_id }, { status: 201 })
    }

    const result = await env.DB.prepare(
      `INSERT INTO budgets (year_month, scope_id, category_id, amount)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (year_month, scope_id, category_id)
       DO UPDATE SET amount = excluded.amount, updated_at = datetime('now')`
    )
      .bind(body.year_month, body.scope_id, body.category_id, body.amount)
      .run()

    return Response.json({ id: result.meta.last_row_id }, { status: 201 })
  }

  // GET /api/fixed_cost_rules 一覧取得(カテゴリ・範囲の表示名を結合)
  if (url.pathname === '/api/fixed_cost_rules' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT
        r.*,
        c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
        s.name AS scope_name
       FROM fixed_cost_rules r
       JOIN categories c ON c.id = r.category_id
       JOIN scopes s ON s.id = r.scope_id
       ORDER BY r.id DESC`
    ).all()
    return Response.json(results)
  }

  type FixedCostRuleBody = {
    title: string
    type: string
    amount: number
    category_id: number
    scope_id: number
    recurrence_unit: string
    recurrence_interval: number
    start_date: string
    end_date: string | null
    holiday_adjustment: string
  }

  const RECURRENCE_UNITS = ['none', 'day', 'weekday', 'week', 'month', 'year']
  const HOLIDAY_ADJUSTMENTS = ['none', 'before', 'after']

  function validateFixedCostRuleBody(body: FixedCostRuleBody): string[] {
    const errors: string[] = []
    if (!body.title || body.title.trim() === '') errors.push('タイトルは必須です')
    if (body.type !== 'income' && body.type !== 'expense') {
      errors.push('type は income または expense を指定してください')
    }
    if (typeof body.amount !== 'number' || !(body.amount > 0)) {
      errors.push('amount は0より大きい数値を指定してください')
    }
    if (!body.category_id) errors.push('category_id は必須です')
    if (!body.scope_id) errors.push('scope_id は必須です')
    if (!RECURRENCE_UNITS.includes(body.recurrence_unit)) {
      errors.push('recurrence_unit の指定が不正です')
    }
    if (!Number.isInteger(body.recurrence_interval) || body.recurrence_interval < 1) {
      errors.push('recurrence_interval は1以上の整数を指定してください')
    }
    if (!body.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) {
      errors.push('start_date は YYYY-MM-DD 形式で指定してください')
    }
    if (body.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.end_date)) {
      errors.push('end_date は YYYY-MM-DD 形式で指定してください')
    }
    if (body.end_date && body.start_date && body.end_date < body.start_date) {
      errors.push('end_date は start_date 以降の日付を指定してください')
    }
    if (!HOLIDAY_ADJUSTMENTS.includes(body.holiday_adjustment)) {
      errors.push('holiday_adjustment の指定が不正です')
    }
    return errors
  }

  // POST /api/fixed_cost_rules 新規作成。作成直後に発生済み分(過去日開始ならバックフィル分含む)を即時生成する
  if (url.pathname === '/api/fixed_cost_rules' && request.method === 'POST') {
    const body = await request.json<FixedCostRuleBody>()
    const errors = validateFixedCostRuleBody(body)
    if (errors.length > 0) {
      return Response.json({ errors }, { status: 400 })
    }

    const result = await env.DB.prepare(
      `INSERT INTO fixed_cost_rules
        (title, type, amount, category_id, scope_id, recurrence_unit, recurrence_interval, start_date, end_date, holiday_adjustment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        body.title.trim(),
        body.type,
        body.amount,
        body.category_id,
        body.scope_id,
        body.recurrence_unit,
        body.recurrence_interval,
        body.start_date,
        body.end_date ?? null,
        body.holiday_adjustment
      )
      .run()

    const id = Number(result.meta.last_row_id)
    await generateDueOccurrences(env, id)
    return Response.json({ id }, { status: 201 })
  }

  // POST /api/fixed_cost_rules/preview 保存前のルール(下書き)から次回以降の発生日をプレビュー
  if (url.pathname === '/api/fixed_cost_rules/preview' && request.method === 'POST') {
    const body = await request.json<FixedCostRuleBody & { occurrence_count?: number }>()
    const errors = validateFixedCostRuleBody(body)
    if (errors.length > 0) {
      return Response.json({ errors }, { status: 400 })
    }
    const dates = previewUpcomingDates(body, body.occurrence_count ?? 0, 5)
    return Response.json({ dates })
  }

  // PUT /api/fixed_cost_rules/:id 編集(以降の発生分のみ新内容を反映。過去生成済みのtransactionsは変更しない)
  const fixedCostRuleIdMatch = url.pathname.match(/^\/api\/fixed_cost_rules\/(\d+)$/)
  if (fixedCostRuleIdMatch && request.method === 'PUT') {
    const id = Number(fixedCostRuleIdMatch[1])
    const body = await request.json<FixedCostRuleBody>()
    const errors = validateFixedCostRuleBody(body)
    if (errors.length > 0) {
      return Response.json({ errors }, { status: 400 })
    }

    await env.DB.prepare(
      `UPDATE fixed_cost_rules SET
        title = ?, type = ?, amount = ?, category_id = ?, scope_id = ?,
        recurrence_unit = ?, recurrence_interval = ?, start_date = ?, end_date = ?, holiday_adjustment = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(
        body.title.trim(),
        body.type,
        body.amount,
        body.category_id,
        body.scope_id,
        body.recurrence_unit,
        body.recurrence_interval,
        body.start_date,
        body.end_date ?? null,
        body.holiday_adjustment,
        id
      )
      .run()

    await generateDueOccurrences(env, id)
    return Response.json({ id })
  }

  // DELETE /api/fixed_cost_rules/:id 削除(過去に生成済みのtransactionsは残したまま、以降の自動生成のみ停止する)
  // D1は外部キー制約を強制するため、削除前にtransactions側の参照(fixed_cost_rule_id)を外しておく
  if (fixedCostRuleIdMatch && request.method === 'DELETE') {
    const id = Number(fixedCostRuleIdMatch[1])
    await env.DB.batch([
      env.DB.prepare('UPDATE transactions SET fixed_cost_rule_id = NULL WHERE fixed_cost_rule_id = ?').bind(id),
      env.DB.prepare('DELETE FROM fixed_cost_rules WHERE id = ?').bind(id)
    ])
    return Response.json({ id })
  }

  return new Response('Not Found', { status: 404 })
}
