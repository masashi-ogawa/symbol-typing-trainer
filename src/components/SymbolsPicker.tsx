export function SymbolsPicker(props: {
  modeLabel: string
  basePool: string[]
  pool: string[]
  enabledMap: Record<string, boolean>
  onEnableAll: () => void
  onDisableAll: () => void
  onToggleItem: (item: string, enabled: boolean) => void
}) {
  const {
    modeLabel,
    basePool,
    pool,
    enabledMap,
    onEnableAll,
    onDisableAll,
    onToggleItem,
  } = props

  return (
    <div className="picker" aria-label="picker">
      <div className="pickerHeader">
        <div className="pickerTitle">
          出題する記号（{pool.length} / {basePool.length}）
          {modeLabel ? ` / ${modeLabel}` : ''}
        </div>
        <div className="pickerButtons">
          <button type="button" className="btn" onClick={onEnableAll}>
            全てON
          </button>
          <button type="button" className="btn" onClick={onDisableAll}>
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
                onChange={(e) => onToggleItem(item, e.target.checked)}
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
  )
}
