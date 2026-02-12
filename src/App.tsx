import './App.css'
import { useTrainer } from './hooks/useTrainer'
import { DigitsSettingsForm } from './components/DigitsSettingsForm'
import { SymbolsPicker } from './components/SymbolsPicker'
import { StatsPanel } from './components/StatsPanel'
import { formatMs } from './domain/time'


export default function App() {
  const { state, actions } = useTrainer()
  const {
    mode,
    isRunning,
    enabledSingle,
    enabledCombo,
    basePool,
    pool,
    digitsSettings,
    target,
    typed,
    totalAttempts,
    totalCorrect,
    totalMiss,
    totalBackspace,
    lastTimeMs,
    accuracy,
    ranked,
  } = state

  const enabledMap = mode === 'single' ? enabledSingle : enabledCombo

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
                actions.setModeAndReset(e.target.value as typeof mode)
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
            onClick={actions.toggleRunning}
          >
            {isRunning ? 'Pause' : 'Resume'}
          </button>

          <button type="button" className="btn" onClick={actions.resetAll}>
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
            <DigitsSettingsForm
              digitsSettings={digitsSettings}
              onChange={actions.setDigitsSettingsAndReset}
            />
          ) : (
            <SymbolsPicker
              modeLabel={mode}
              basePool={basePool}
              pool={pool}
              enabledMap={enabledMap}
              onEnableAll={actions.enableAllInCurrentMode}
              onDisableAll={actions.disableAllInCurrentMode}
              onToggleItem={(item, enabled) => actions.setEnabledForItemInCurrentMode(item, enabled)}
            />
          )}
        </section>

        <StatsPanel
          totalAttempts={totalAttempts}
          totalCorrect={totalCorrect}
          totalMiss={totalMiss}
          totalBackspace={totalBackspace}
          accuracy={accuracy}
          ranked={ranked}
        />
      </main>

      <footer className="footer">
        <div className="meta">
          Pool size: {pool.length} / Mode: {mode} / {isRunning ? 'Running' : 'Paused'}
        </div>
      </footer>
    </div>
  )
}
