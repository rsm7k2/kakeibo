// Cloudflare Workers 側で実装するAPIエンドポイントへのラッパー。
// 開発中はWorkerも同一プロジェクトから配信するため、相対パスでの呼び出しを想定。

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { errors?: string[] } | null
    throw new Error(body?.errors?.[0] ?? `API error: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
}
