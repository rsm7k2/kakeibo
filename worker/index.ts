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
  // 例: GET /api/categories 一覧取得
  if (url.pathname === '/api/categories' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM categories ORDER BY sort_order'
    ).all()
    return Response.json(results)
  }

  // 例: POST /api/transactions 新規登録
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
        body.payment_method_id,
        body.transaction_date,
        body.memo
      )
      .run()

    return Response.json({ id: result.meta.last_row_id }, { status: 201 })
  }

  // 各エンドポイント(scopes, payment_methods, budgets, レポート集計等)は
  // 画面実装のタイミングで順次追加してください
  return new Response('Not Found', { status: 404 })
}
