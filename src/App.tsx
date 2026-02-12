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

  const pool = useMemo(() => {
    return mode === 'single' ? [...SINGLE_SYMBOLS] : [...COMBOS]
  }, [mode])

  const [target, setTarget] = useState<string>(() => pickRandom(pool))
  const [typed, setTyped] = useState<string>('')

  const [totalAttempts, setTotalAttempts] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [totalMiss, setTotalMiss] = useState(0)
  const [lastTimeMs, setLastTimeMs] = useState<number | null>(null)

  const [statsByItem, setStatsByItem] = useState<Record<string, Stat>>({})

  const shownAtRef = useRef<number>(nowMs())

  // When mode changes, reset with a new target from the new pool.
  useEffect(() => {
    const next = pickRandom(pool)
    setTarget(next)
    setTyped('')
    shownAtRef.current = nowMs()
    // keep totals; they are useful across modes
  }, [pool])

  const nextQuestion = () => {
    const next = pickRandom(pool)
    setTarget(next)
    setTyped('')
    shownAtRef.current = nowMs()
  }

  const resetAll = () => {
    setTotalAttempts(0)
    setTotalCorrect(0)
    setTotalMiss(0)
    setLastTimeMs(null)
    setStatsByItem({})
    const next = pickRandom(pool)
    setTarget(next)
    setTyped('')
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

      // Let browser shortcuts work (Cmd+R etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = normalizeKey(e.key)
      if (!key) return

      // Ignore non-printable keys.
      if (key.length !== 1) return

      e.preventDefault()

      const nextTyped = typed + key

      // If the prefix is still matching, keep going.
      if (target.startsWith(nextTyped)) {
        setTyped(nextTyped)

        // Completed.
        if (nextTyped === target) {
          const elapsed = nowMs() - shownAtRef.current
          setLastTimeMs(elapsed)

          setTotalAttempts(v => v + 1)
          setTotalCorrect(v => v + 1)
          bumpStat(target, true, elapsed)

          nextQuestion()
        }
        return
      }

      // Mismatch -> count as miss attempt, then reset typed buffer.
      setTotalAttempts(v => v + 1)
      setTotalMiss(v => v + 1)
      bumpStat(target, false)
      setTyped('')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isRunning, target, typed, pool])

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
          <div className="target" aria-label="target">{target}</div>
          <div className="hint" aria-label="status">
            <span className="label">Typed:</span>
            <span className="typed">{typed || '—'}</span>
          </div>
          <div className="hint">
            <span className="label">Last:</span>
            <span>{lastTimeMs == null ? '—' : formatMs(lastTimeMs)}</span>
          </div>
          <p className="help">
            画面をクリックする必要はありません（キー入力は全体で拾います）。
            ミスすると入力バッファがリセットされます。
          </p>
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
