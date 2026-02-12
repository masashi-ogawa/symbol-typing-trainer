export function nowMs(): number {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now())
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '-'
  return `${Math.round(ms)} ms`
}
