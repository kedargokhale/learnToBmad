import type { LedgerRunningBalanceData } from "../../ledger/service";

type RunningBalanceViewProps = {
  runningBalance?: LedgerRunningBalanceData;
};

export function RunningBalanceView({ runningBalance }: RunningBalanceViewProps) {
  const data = runningBalance ?? {
    windowPreset: "30d",
    points: [],
  };

  return (
    <article className="story-card running-balance-card" aria-label="Running balance">
      <header className="story-card-header">
        <h3>Running balance</h3>
        <p>Ordered trajectory for the active preset window ({data.windowPreset}).</p>
      </header>

      {data.points.length === 0 ? (
        <div className="story-card-empty" role="status">
          No running-balance points available for this preset window yet.
        </div>
      ) : (
        <ol className="story-card-list" aria-label="Running balance points">
          {data.points.map((point) => (
            <li key={`${point.entryKind}-${point.entryId}-${point.timestamp}`} className="story-card-item">
              <div>
                <strong>{humanizeEntryKind(point.entryKind)}</strong>
                <div className="story-card-meta">#{point.entryId} | {point.timestamp}</div>
                <div className="story-card-meta">Delta {formatSignedMinorUnits(point.deltaMinor)}</div>
              </div>
              <span>{formatMinorUnits(point.balanceMinor)}</span>
            </li>
          ))}
        </ol>
      )}
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

function formatSignedMinorUnits(value: number): string {
  const formatted = formatMinorUnits(Math.abs(value));
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

function humanizeEntryKind(entryKind: string): string {
  return entryKind
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
