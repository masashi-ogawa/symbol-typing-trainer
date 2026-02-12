import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Mode = 'single' | 'combo'

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
    return mode === 'single' ? [...SINGLE_SYMBOLS] : [...COMBOS]
  }, [mode])

  const enabledMap = mode === 'single' ? enabledSingle : enabledCombo

  const pool = useMemo(() => {
    return basePool.filter(item => enabledMap[item] !== false)
  }, [basePool, enabledMap])

  const [target, setTarget] = useState<string>(() => pickRandom(pool))
  // `typed` is what we show to the user: everything they typed until they solve the current target.
  const [typed, setTyped] = useState<string>('')
  // `progress` is the current matching buffer (resets on mismatch).
  const [progress, setProgress] = useState<string>('')

  const [totalAttempts, setTotalAttempts] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [totalMiss, setTotalMiss] = useState(0)
  const [lastTimeMs, setLastTimeMs] = useState<number | null>(null)

  const [statsByItem, setStatsByItem] = useState<Record<string, Stat>>({})

  const shownAtRef = useRef<number>(nowMs())

  // When mode changes, reset with a new target from the new pool.
  useEffect(() => {
    if (pool.length === 0) {
      setTarget('')
    } else {
      const next = pickRandom(pool)
      setTarget(next)
    }
    setTyped('')
    setProgress('')
    shownAtRef.current = nowMs()
    // keep totals; they are useful across modes
  }, [pool])

  const nextQuestion = () => {
    if (pool.length === 0) return
    const next = pickRandom(pool)
    setTarget(next)
    setTyped('')
    setProgress('')
    shownAtRef.current = nowMs()
  }

  const resetAll = () => {
    setTotalAttempts(0)
    setTotalCorrect(0)
    setTotalMiss(0)
    setLastTimeMs(null)
    setStatsByItem({})
    if (pool.length === 0) {
      setTarget('')
    } else {
      const next = pickRandom(pool)
      setTarget(next)
    }
    setTyped('')
    setProgress('')
    shownAtRef.current = nowMs()
  }

  const bumpStat = (item: string, isCorrect: boolean, elapsedMs?: number) => {
    setStatsByItem(prev => {
      const current = prev[item] ?? { attempts: 0, correct: 0, totalMs: 0 }
      const next: Stat = {
        attempts: current.attempts + 1,
        correct: current.correct + (isCorrect ? 1 : 0),
        totalMs: current.totalMs + (isCorrect && elapsedMs != null ? elapsedMs : 0),
      }
      return { ...prev, [item]: next }
    })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isRunning) return
      if (!target) return

      // Let browser shortcuts work (Cmd+R etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return

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
  }, [isRunning, target, progress, pool])

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
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="single">1文字</option>
              <option value="combo">2〜3文字</option>
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
          <div className="target" aria-label="target">{pool.length === 0 ? '—' : target}</div>
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
            ミスすると入力バッファがリセットされます。
          </p>

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
                    if (mode === 'single') setEnabledSingle(initEnabledMap(SINGLE_SYMBOLS))
                    else setEnabledCombo(initEnabledMap(COMBOS))
                  }}
                >
                  全てON
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const next = Object.fromEntries(basePool.map(item => [item, false]))
                    if (mode === 'single') setEnabledSingle(next)
                    else setEnabledCombo(next)
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
                          setEnabledSingle(prev => ({ ...prev, [item]: checked }))
                        } else {
                          setEnabledCombo(prev => ({ ...prev, [item]: checked }))
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
