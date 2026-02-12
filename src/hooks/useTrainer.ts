import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DigitsSettings } from '../domain/digits'
import { generateDigitsTarget } from '../domain/digits'
import type { Mode } from '../domain/modes'
import { normalizeKey } from '../domain/keyboard'
import { pickRandom, clampInt } from '../domain/random'
import { nowMs } from '../domain/time'
import { COMBOS, initEnabledMap, SINGLE_SYMBOLS } from '../domain/symbols'

type Stat = {
  attempts: number
  correct: number
  totalMs: number
}

type RankedStat = {
  item: string
  attempts: number
  correct: number
  totalMs: number
  acc: number
  avg: number | null
}

export type TrainerState = {
  mode: Mode
  isRunning: boolean

  enabledSingle: Record<string, boolean>
  enabledCombo: Record<string, boolean>

  basePool: string[]
  pool: string[]

  digitsSettings: DigitsSettings

  target: string
  typed: string
  progress: string

  totalAttempts: number
  totalCorrect: number
  totalMiss: number
  totalBackspace: number
  lastTimeMs: number | null

  accuracy: number
  ranked: RankedStat[]
}

export type TrainerActions = {
  setModeAndReset: (mode: Mode) => void
  toggleRunning: () => void
  resetAll: () => void

  setDigitsSettingsAndReset: (next: DigitsSettings) => void

  enableAllInCurrentMode: () => void
  disableAllInCurrentMode: () => void
  setEnabledForItemInCurrentMode: (item: string, enabled: boolean) => void
}

export function useTrainer(): { state: TrainerState, actions: TrainerActions } {
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

  const setModeAndReset = useCallback((nextMode: Mode) => {
    setMode(nextMode)
    resetQuestion(nextMode)
  }, [resetQuestion])

  const toggleRunning = useCallback(() => {
    setIsRunning(v => !v)
  }, [])

  const resetAll = useCallback(() => {
    setTotalAttempts(0)
    setTotalCorrect(0)
    setTotalMiss(0)
    setTotalBackspace(0)
    setLastTimeMs(null)
    setStatsByItem({})
    resetQuestion(mode)
  }, [mode, resetQuestion])

  const setDigitsSettingsAndReset = useCallback((next: DigitsSettings) => {
    const normalized: DigitsSettings = {
      ...next,
      minIntDigits: clampInt(next.minIntDigits, 1, 50),
      maxIntDigits: clampInt(next.maxIntDigits, 1, 50),
      minFracDigits: clampInt(next.minFracDigits, 1, 50),
      maxFracDigits: clampInt(next.maxFracDigits, 1, 50),
    }
    normalized.minIntDigits = Math.min(normalized.minIntDigits, normalized.maxIntDigits)
    normalized.maxIntDigits = Math.max(normalized.maxIntDigits, normalized.minIntDigits)
    normalized.minFracDigits = Math.min(normalized.minFracDigits, normalized.maxFracDigits)
    normalized.maxFracDigits = Math.max(normalized.maxFracDigits, normalized.minFracDigits)
    setDigitsSettings(normalized)
    resetQuestion('digits', { digitsSettings: normalized })
  }, [resetQuestion])

  const enableAllInCurrentMode = useCallback(() => {
    if (mode === 'digits') return
    if (mode === 'single') {
      const next = initEnabledMap(SINGLE_SYMBOLS)
      setEnabledSingle(next)
      resetQuestion('single', { enabledSingle: next })
    } else {
      const next = initEnabledMap(COMBOS)
      setEnabledCombo(next)
      resetQuestion('combo', { enabledCombo: next })
    }
  }, [mode, resetQuestion])

  const disableAllInCurrentMode = useCallback(() => {
    if (mode === 'digits') return
    const next = Object.fromEntries(basePool.map(item => [item, false]))
    if (mode === 'single') {
      setEnabledSingle(next)
      resetQuestion('single', { enabledSingle: next })
    } else {
      setEnabledCombo(next)
      resetQuestion('combo', { enabledCombo: next })
    }
  }, [basePool, mode, resetQuestion])

  const setEnabledForItemInCurrentMode = useCallback((item: string, enabled: boolean) => {
    if (mode === 'digits') return
    if (mode === 'single') {
      const next = { ...enabledSingle, [item]: enabled }
      setEnabledSingle(next)
      resetQuestion('single', { enabledSingle: next })
    } else {
      const next = { ...enabledCombo, [item]: enabled }
      setEnabledCombo(next)
      resetQuestion('combo', { enabledCombo: next })
    }
  }, [enabledCombo, enabledSingle, mode, resetQuestion])

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

  return {
    state: {
      mode,
      isRunning,
      enabledSingle,
      enabledCombo,
      basePool,
      pool,
      digitsSettings,
      target,
      typed,
      progress,
      totalAttempts,
      totalCorrect,
      totalMiss,
      totalBackspace,
      lastTimeMs,
      accuracy,
      ranked,
    },
    actions: {
      setModeAndReset,
      toggleRunning,
      resetAll,
      setDigitsSettingsAndReset,
      enableAllInCurrentMode,
      disableAllInCurrentMode,
      setEnabledForItemInCurrentMode,
    },
  }
}
