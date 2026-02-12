export const SINGLE_SYMBOLS = [
  // brackets
  '(', ')', '[', ']', '{', '}', '<', '>',
  // punctuation
  ',', '.', ':', ';', '!', '?',
  // quotes
  "'", '"',
  // operators
  '+', '-', '*', '/', '=',
  // misc
  '_', '@', '#', '$', '%', '^', '&', '|', '\\', '~', '`',
] as const

export const COMBOS = [
  // comparisons / arrows
  '=>', '->', '<-', '!=', '==', '===', '<=', '>=',
  // logic
  '&&', '||', '??', '?:',
  // access / scope
  '::', '->>', '?.', '??=',
  // ranges / dots
  '..', '...',
  // comments / blocks
  '//', '/*', '*/',
  // html-ish
  '</', '/>',
] as const

export function initEnabledMap(list: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(list.map(item => [item, true]))
}
