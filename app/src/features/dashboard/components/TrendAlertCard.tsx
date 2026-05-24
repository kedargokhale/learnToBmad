import type { LedgerTrendAlertData } from "../../ledger/service";

type TrendAlertCardProps = {
  trendAlert?: LedgerTrendAlertData;
};

export function TrendAlertCard({ trendAlert }: TrendAlertCardProps) {
  const data = trendAlert ?? {
    windowPreset: "30d",
    currentSpendMinor: 0,
    baselineSpendMinor: 0,
    deltaPercent: 0,
    thresholdPercent: 20,
    isAlert: false,
    reason: "Not enough persisted debit history to compare trend windows.",
  };

  return (
    <article className="story-card trend-card" aria-label="Trend signal">
      <header className="story-card-header">
        <h3>Trend signal</h3>
        <p>Spend movement compared to the previous matching window.</p>
      </header>

      <div className={`trend-pill ${data.isAlert ? "trend-pill--alert" : "trend-pill--stable"}`}>
        {data.isAlert ? "Alert" : "Stable"} | Window {data.windowPreset}
      </div>

      <ol className="story-card-list" aria-label="Trend details">
        <li className="story-card-item">
          <div>
            <strong>Current spend</strong>
            <div className="story-card-meta">Persisted debit total in active window</div>
          </div>
          <span>{formatMinorUnits(data.currentSpendMinor)}</span>
        </li>
        <li className="story-card-item">
          <div>
            <strong>Baseline spend</strong>
            <div className="story-card-meta">Previous matching window total</div>
          </div>
          <span>{formatMinorUnits(data.baselineSpendMinor)}</span>
        </li>
        <li className="story-card-item">
          <div>
            <strong>Threshold</strong>
            <div className="story-card-meta">Alert threshold for increase detection</div>
          </div>
          <span>{data.thresholdPercent.toFixed(1)}%</span>
        </li>
      </ol>

      <div className="story-card-empty" role="status">
        {data.reason}
      </div>
    </article>
  );
}

function formatMinorUnits(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value / 100);
}
