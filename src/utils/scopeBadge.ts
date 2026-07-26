// 範囲(個人/世帯など)のバッジ配色。scope_id に応じて一覧から順番に割り当てる
const SCOPE_BADGE_CLASSES = [
  'bg-blue-50 text-blue-500',
  'bg-purple-50 text-purple-500',
  'bg-teal-50 text-teal-600',
  'bg-orange-50 text-orange-500',
  'bg-pink-50 text-pink-500'
]

export function scopeBadgeClass(scopeId: number): string {
  return SCOPE_BADGE_CLASSES[(scopeId - 1 + SCOPE_BADGE_CLASSES.length) % SCOPE_BADGE_CLASSES.length]
}
