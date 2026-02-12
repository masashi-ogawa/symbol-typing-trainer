import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Mode = 'single' | 'combo' | 'digits'

type DigitsSettings = {
  minIntDigits: number
  maxIntDigits: number
  enableSign: boolean
  enableDecimal: boolean
  minFracDigits: number
  maxFracDigits: number
}

type Stat = {
  attempts: number
  correct: number
  totalMs: number
}

const SINGLE_SYMBOLS = [
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

const COMBOS = [
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

function initEnabledMap(list: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(list.map(item => [item, true]))
}

function nowMs(): number {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now())
}

function normalizeKey(k: string): string {
  // We only care about printable characters; keep Enter/Tab/Escape as-is for possible future use.
  if (k === 'Enter' || k === 'Tab' || k === 'Escape') return k
  // Some environments report 'Dead' for composition keys; ignore those.
  if (k === 'Dead') return ''
  return k
}

function pickRandom(list: readonly string[]): string {
  return list[Math.floor(Math.random() * list.length)]
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function randomInt(min: number, max: number): number {
  const a = Math.min(min, max)
  const b = Math.max(min, max)
  return a + Math.floor(Math.random() * (b - a + 1))
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

function generateDigitsTarget(settings: DigitsSettings): string {
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

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '-'
  return `${Math.round(ms)} ms`
}

export default function App() {
  const [mode, setMode] = useState<Mode>('single')
  const [isRunning, setIsRunning] = useState(true)

  const [enabledSingle, setEnabledSingle] = useState<Record<string, boolean>>(() => initEnabledMap(SINGLE_SYMBOLS))
  const [enabledCombo, setEnabledCombo] = useState<Record<string, boolean>>(() => initEnabledMap(COMBOS))

  const basePool = useMemo(() => {
    if (mode === 'digits') return []
    return mode === 'single' ? [...SINGLE_SYMBOLS] : [...COMBOS]
  }, [mode])

  const enabledMap = mode === 'single' ? enabledSingle : enabledCombo

  const pool = useMemo(() => {
    return basePool.filter(item => enabledMap[item] !== false)
  }, [basePool, enabledMap])

  const [digitsSettings, setDigitsSettings] = useState<DigitsSettings>(() => ({
    minIntDigits: 3,
    maxIntDigits: 7,
    enableSign: false,
    enableDecimal: false,
    minFracDigits: 1,
    maxFracDigits: 4,
  }))

  const [target, setTarget] = useState<string>(() => pickRandom(SINGLE_SYMBOLS))
  // `typed` is what we show to the user: everything they typed until they solve the current target.
  const [typed, setTyped] = useState<string>('')
  // `progress` is the current matching buffer (resets on mismatch).
  const [progress, setProgress] = useState<string>('')

  const [totalAttempts, setTotalAttempts] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [totalMiss, setTotalMiss] = useState(0)
  const [totalBackspace, setTotalBackspace] = useState(0)
  const [lastTimeMs, setLastTimeMs] = useState<number | null>(null)

  const [statsByItem, setStatsByItem] = useState<Record<string, Stat>>({})

  const shownAtRef = useRef<number>(nowMs())

  const resetQuestion = useCallback((nextMode: Mode, overrides?: {
    enabledSingle?: Record<string, boolean>
    enabledCombo?: Record<string, boolean>
    digitsSettings?: DigitsSettings
  }) => {
    const effectiveDigitsSettings = overrides?.digitsSettings ?? digitsSettings
    const effectiveEnabledSingle = overrides?.enabledSingle ?? enabledSingle
    const effectiveEnabledCombo = overrides?.enabledCombo ?? enabledCombo

    if (nextMode === 'digits') {
      setTarget(generateDigitsTarget(effectiveDigitsSettings))
      setTyped('')
      setProgress('')
      shownAtRef.current = nowMs()
      return
    }

    const list = nextMode === 'single' ? [...SINGLE_SYMBOLS] : [...COMBOS]
    const enabled = nextMode === 'single' ? effectiveEnabledSingle : effectiveEnabledCombo
    const nextPool = list.filter(item => enabled[item] !== false)
    setTarget(nextPool.length === 0 ? '' : pickRandom(nextPool))
    setTyped('')
    setProgress('')
    shownAtRef.current = nowMs()
  }, [digitsSettings, enabledCombo, enabledSingle])

  const nextQuestion = useCallback(() => {
    if (mode === 'digits') {
      resetQuestion('digits')
      return
    }
    if (pool.length === 0) return
    const next = pickRandom(pool)
    setTarget(next)
    setTyped('')
    setProgress('')
    shownAtRef.current = nowMs()
  }, [mode, pool, resetQuestion])

  const resetAll = () => {
    setTotalAttempts(0)
    setTotalCorrect(0)
    setTotalMiss(0)
    setTotalBackspace(0)
    setLastTimeMs(null)
    setStatsByItem({})
    resetQuestion(mode)
  }

  const bumpStat = useCallback((item: string, isCorrect: boolean, elapsedMs?: number) => {
    setStatsByItem(prev => {
      const current = prev[item] ?? { attempts: 0, correct: 0, totalMs: 0 }
      const next: Stat = {
        attempts: current.attempts + 1,
        correct: current.correct + (isCorrect ? 1 : 0),
        totalMs: current.totalMs + (isCorrect && elapsedMs != null ? elapsedMs : 0),
      }
      return { ...prev, [item]: next }
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isRunning) return
      if (!target) return

      // Let browser shortcuts work (Cmd+R etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (mode === 'digits') {
        if (e.key === 'Backspace') {
          e.preventDefault()
          setTotalBackspace(v => v + 1)
          setTyped(prev => prev.slice(0, -1))
          setProgress(prev => prev.slice(0, -1))
          return
        }

        const key = normalizeKey(e.key)
        if (!key) return
        if (key.length !== 1) return

        e.preventDefault()

        const expected = target[progress.length] ?? ''
        if (key === expected) {
          const nextProgress = progress + key
          setTyped(nextProgress)
          setProgress(nextProgress)

          if (nextProgress === target) {
            const elapsed = nowMs() - shownAtRef.current
            setLastTimeMs(elapsed)

            setTotalAttempts(v => v + 1)
            setTotalCorrect(v => v + 1)
            bumpStat(target, true, elapsed)

            nextQuestion()
          }
          return
        }

        // Mismatch: count as miss attempt. Progress does not reset (Backspace can fix).
        setTotalAttempts(v => v + 1)
        setTotalMiss(v => v + 1)
        bumpStat(target, false)
        return
      }

      const key = normalizeKey(e.key)
      if (!key) return

      // Ignore non-printable keys.
      if (key.length !== 1) return

      e.preventDefault()

      // Always show what the user actually typed.
      setTyped(prev => prev + key)

      const nextProgress = progress + key

      // If the prefix is still matching, keep going.
      if (target.startsWith(nextProgress)) {
        setProgress(nextProgress)

        // Completed.
        if (nextProgress === target) {
          const elapsed = nowMs() - shownAtRef.current
          setLastTimeMs(elapsed)

          setTotalAttempts(v => v + 1)
          setTotalCorrect(v => v + 1)
          bumpStat(target, true, elapsed)

          nextQuestion()
        }
        return
      }

      // Mismatch -> count as miss attempt, then reset matching buffer.
      setTotalAttempts(v => v + 1)
      setTotalMiss(v => v + 1)
      bumpStat(target, false)
      setProgress('')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bumpStat, isRunning, mode, nextQuestion, progress, target])

  const accuracy = totalAttempts === 0 ? 0 : (totalCorrect / totalAttempts) * 100

  const ranked = useMemo(() => {
    const entries = Object.entries(statsByItem)
    // Rank by (lowest accuracy, then most attempts)
    return entries
      .map(([item, s]) => {
        const acc = s.attempts === 0 ? 0 : (s.correct / s.attempts) * 100
        const avg = s.correct === 0 ? null : s.totalMs / s.correct
        return { item, ...s, acc, avg }
      })
      .sort((a, b) => {
        if (a.acc !== b.acc) return a.acc - b.acc
        return b.attempts - a.attempts
      })
      .slice(0, 10)
  }, [statsByItem])

  return (
    <div className="app">
      <header className="header">
        <h1>Symbol Typing Trainer</h1>
        <div className="controls">
          <label className="control">
            Mode
            <select
              value={mode}
              onChange={(e) => {
                const nextMode = e.target.value as Mode
                setMode(nextMode)
                resetQuestion(nextMode)
              }}
            >
              <option value="single">1文字</option>
              <option value="combo">2〜3文字</option>
              <option value="digits">数字</option>
            </select>
          </label>

          <button
            type="button"
            className="btn"
            onClick={() => setIsRunning(v => !v)}
          >
            {isRunning ? 'Pause' : 'Resume'}
          </button>

          <button type="button" className="btn" onClick={resetAll}>
            Reset
          </button>
        </div>
      </header>

      <main className="main">
        <section className="trainer" aria-label="trainer">
          <div className="target" aria-label="target">{mode === 'digits' ? (target || '—') : (pool.length === 0 ? '—' : target)}</div>
          <div className="hint" aria-label="status">
            <span className="label">Typed:</span>
            <span className="typed">{typed || ''}</span>
          </div>
          <div className="hint">
            <span className="label">Last:</span>
            <span>{lastTimeMs == null ? '' : formatMs(lastTimeMs)}</span>
          </div>
          <p className="help">
            画面をクリックする必要はありません（キー入力は全体で拾います）。
            {mode === 'digits'
              ? 'ミスしても進捗は戻りません（Backspaceで修正できます）。'
              : 'ミスすると入力バッファがリセットされます。'}
          </p>

          {mode === 'digits' ? (
            <div className="picker" aria-label="digits-settings">
              <div className="pickerHeader">
                <div className="pickerTitle">出題設定（数字）</div>
              </div>

              <div className="checkGrid" role="group" aria-label="digits-options">
                <label className="checkItem">
                  <span>整数 桁数(min)</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={digitsSettings.minIntDigits}
                    onChange={(e) => {
                      const v = clampInt(Number(e.target.value), 1, 50)
                      const next = { ...digitsSettings, minIntDigits: Math.min(v, digitsSettings.maxIntDigits) }
                      setDigitsSettings(next)
                      resetQuestion('digits', { digitsSettings: next })
                    }}
                  />
                </label>
                <label className="checkItem">
                  <span>整数 桁数(max)</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={digitsSettings.maxIntDigits}
                    onChange={(e) => {
                      const v = clampInt(Number(e.target.value), 1, 50)
                      const next = { ...digitsSettings, maxIntDigits: Math.max(v, digitsSettings.minIntDigits) }
                      setDigitsSettings(next)
                      resetQuestion('digits', { digitsSettings: next })
                    }}
                  />
                </label>

                <label className="checkItem">
                  <input
                    type="checkbox"
                    checked={digitsSettings.enableSign}
                    onChange={(e) => {
                      const next = { ...digitsSettings, enableSign: e.target.checked }
                      setDigitsSettings(next)
                      resetQuestion('digits', { digitsSettings: next })
                    }}
                  />
                  <span className="mono">符号（+/-）</span>
                </label>

                <label className="checkItem">
                  <input
                    type="checkbox"
                    checked={digitsSettings.enableDecimal}
                    onChange={(e) => {
                      const next = { ...digitsSettings, enableDecimal: e.target.checked }
                      setDigitsSettings(next)
                      resetQuestion('digits', { digitsSettings: next })
                    }}
                  />
                  <span className="mono">小数（.）</span>
                </label>

                <label className="checkItem">
                  <span>小数 桁数(min)</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    disabled={!digitsSettings.enableDecimal}
                    value={digitsSettings.minFracDigits}
                    onChange={(e) => {
                      const v = clampInt(Number(e.target.value), 1, 50)
                      const next = { ...digitsSettings, minFracDigits: Math.min(v, digitsSettings.maxFracDigits) }
                      setDigitsSettings(next)
                      resetQuestion('digits', { digitsSettings: next })
                    }}
                  />
                </label>
                <label className="checkItem">
                  <span>小数 桁数(max)</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    disabled={!digitsSettings.enableDecimal}
                    value={digitsSettings.maxFracDigits}
                    onChange={(e) => {
                      const v = clampInt(Number(e.target.value), 1, 50)
                      const next = { ...digitsSettings, maxFracDigits: Math.max(v, digitsSettings.minFracDigits) }
                      setDigitsSettings(next)
                      resetQuestion('digits', { digitsSettings: next })
                    }}
                  />
                </label>
              </div>
            </div>
          ) : (
          <div className="picker" aria-label="picker">
            <div className="pickerHeader">
              <div className="pickerTitle">
                出題する記号（{pool.length} / {basePool.length}）
              </div>
              <div className="pickerButtons">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (mode === 'single') {
                      const next = initEnabledMap(SINGLE_SYMBOLS)
                      setEnabledSingle(next)
                      resetQuestion('single', { enabledSingle: next })
                    } else {
                      const next = initEnabledMap(COMBOS)
                      setEnabledCombo(next)
                      resetQuestion('combo', { enabledCombo: next })
                    }
                  }}
                >
                  全てON
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const next = Object.fromEntries(basePool.map(item => [item, false]))
                    if (mode === 'single') {
                      setEnabledSingle(next)
                      resetQuestion('single', { enabledSingle: next })
                    } else {
                      setEnabledCombo(next)
                      resetQuestion('combo', { enabledCombo: next })
                    }
                  }}
                >
                  全てOFF
                </button>
              </div>
            </div>

            {basePool.length === 0 ? null : (
              <div className="checkGrid" role="group" aria-label="symbols">
                {basePool.map(item => (
                  <label key={item} className="checkItem">
                    <input
                      type="checkbox"
                      checked={enabledMap[item] !== false}
                      onChange={(e) => {
                        const checked = e.target.checked
                        if (mode === 'single') {
                          const next = { ...enabledSingle, [item]: checked }
                          setEnabledSingle(next)
                          resetQuestion('single', { enabledSingle: next })
                        } else {
                          const next = { ...enabledCombo, [item]: checked }
                          setEnabledCombo(next)
                          resetQuestion('combo', { enabledCombo: next })
                        }
                      }}
                    />
                    <span className="mono">{item}</span>
                  </label>
                ))}
              </div>
            )}

            {pool.length === 0 ? (
              <div className="empty">出題する記号がありません。チェックを入れてください。</div>
            ) : null}
          </div>
          )}
        </section>

        <section className="stats" aria-label="stats">
          <h2>Stats</h2>
          <div className="statGrid">
            <div className="statCard">
              <div className="statLabel">Attempts</div>
              <div className="statValue">{totalAttempts}</div>
            </div>
            <div className="statCard">
              <div className="statLabel">Correct</div>
              <div className="statValue">{totalCorrect}</div>
            </div>
            <div className="statCard">
              <div className="statLabel">Miss</div>
              <div className="statValue">{totalMiss}</div>
            </div>
            <div className="statCard">
              <div className="statLabel">Backspace</div>
              <div className="statValue">{totalBackspace}</div>
            </div>
            <div className="statCard">
              <div className="statLabel">Accuracy</div>
              <div className="statValue">{accuracy.toFixed(1)}%</div>
            </div>
          </div>

          <h3 className="subhead">苦手トップ10（低正答率 → 高試行）</h3>
          {ranked.length === 0 ? (
            <div className="empty">まだデータがありません</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Acc</th>
                  <th>Attempts</th>
                  <th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(r => (
                  <tr key={r.item}>
                    <td className="mono">{r.item}</td>
                    <td>{r.acc.toFixed(1)}%</td>
                    <td>{r.attempts}</td>
                    <td>{r.avg == null ? '—' : formatMs(r.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="meta">
          Pool size: {pool.length} / Mode: {mode} / {isRunning ? 'Running' : 'Paused'}
        </div>
      </footer>
    </div>
  )
}
