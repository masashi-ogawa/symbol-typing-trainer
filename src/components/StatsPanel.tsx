import { formatMs } from '../domain/time'

export type RankedStat = {
  item: string
  attempts: number
  acc: number
  avg: number | null
}

export function StatsPanel(props: {
  totalAttempts: number
  totalCorrect: number
  totalMiss: number
  totalBackspace: number
  accuracy: number
  ranked: RankedStat[]
}) {
  const {
    totalAttempts,
    totalCorrect,
    totalMiss,
    totalBackspace,
    accuracy,
    ranked,
  } = props

  return (
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
  )
}
