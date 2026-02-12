import type { DigitsSettings } from '../domain/digits'
import { clampInt } from '../domain/random'

export function DigitsSettingsForm(props: {
  digitsSettings: DigitsSettings
  onChange: (next: DigitsSettings) => void
}) {
  const { digitsSettings, onChange } = props

  return (
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
              onChange(next)
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
              onChange(next)
            }}
          />
        </label>

        <label className="checkItem">
          <input
            type="checkbox"
            checked={digitsSettings.enableSign}
            onChange={(e) => {
              const next = { ...digitsSettings, enableSign: e.target.checked }
              onChange(next)
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
              onChange(next)
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
              onChange(next)
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
              onChange(next)
            }}
          />
        </label>
      </div>
    </div>
  )
}
