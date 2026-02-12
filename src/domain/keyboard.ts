export function normalizeKey(k: string): string {
  // We only care about printable characters; keep Enter/Tab/Escape as-is for possible future use.
  if (k === 'Enter' || k === 'Tab' || k === 'Escape') return k
  // Some environments report 'Dead' for composition keys; ignore those.
  if (k === 'Dead') return ''
  return k
}
