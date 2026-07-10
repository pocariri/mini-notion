export function charCount(text: string): number {
  return text.length
}

export function formatDate(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '방금'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`
  const d = new Date(ts)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
