import { clampInt, randomInt } from './random'

export type DigitsSettings = {
  minIntDigits: number
  maxIntDigits: number
  enableSign: boolean
  enableDecimal: boolean
  minFracDigits: number
  maxFracDigits: number
}

function buildDigitsString(len: number, opts: { firstNonZero?: boolean } = {}): string {
  const n = Math.max(1, Math.trunc(len))
  const chars: string[] = []
  for (let i = 0; i < n; i++) {
    const digit = (i === 0 && opts.firstNonZero) ? randomInt(1, 9) : randomInt(0, 9)
    chars.push(String(digit))
  }
  return chars.join('')
}

export function generateDigitsTarget(settings: DigitsSettings): string {
  const minIntDigits = clampInt(settings.minIntDigits, 1, 50)
  const maxIntDigits = clampInt(settings.maxIntDigits, 1, 50)
  const minFracDigits = clampInt(settings.minFracDigits, 1, 50)
  const maxFracDigits = clampInt(settings.maxFracDigits, 1, 50)

  const intLen = randomInt(minIntDigits, maxIntDigits)

  const decimalRatio = settings.enableDecimal ? 0.3 : 0
  const signRatio = settings.enableSign ? 0.3 : 0

  const withDecimal = Math.random() < decimalRatio
  const withSign = Math.random() < signRatio

  const sign = withSign ? (Math.random() < 0.5 ? '+' : '-') : ''

  if (!withDecimal) {
    // Integer: no leading zero.
    return sign + buildDigitsString(intLen, { firstNonZero: true })
  }

  // Decimal: always `intPart + '.' + fracPart`.
  // Integer part allows leading zero (fully random) per requirement.
  const intPart = buildDigitsString(intLen)
  const fracLen = randomInt(minFracDigits, maxFracDigits)
  const fracPart = buildDigitsString(fracLen)
  return sign + intPart + '.' + fracPart
}
