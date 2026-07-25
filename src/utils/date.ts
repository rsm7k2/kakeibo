// 端末のタイムゾーン設定に関わらず、常に日本時間(Asia/Tokyo)を基準に
// 現在日付を取得するためのユーティリティ。

const JST_TZ = 'Asia/Tokyo'

/** 日本時間での「今日」を 'YYYY-MM-DD' 形式で返す */
export function todayJst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

/** 日本時間での「今月」を year / month0(0始まり) で返す */
export function nowJstYearMonth(): { year: number; month0: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JST_TZ,
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date())

  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value) // 1〜12

  return { year, month0: month - 1 }
}
