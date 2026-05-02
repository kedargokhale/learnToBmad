import type { LedgerBaselineData } from "../service";

type LedgerBaselineViewProps = {
  baseline: LedgerBaselineData;
  onRefresh?: () => Promise<void>;
};

export function LedgerBaselineView({ baseline, onRefresh }: LedgerBaselineViewProps) {
  const account = baseline.account;

  if (!account) {
    return null;
  }

  return (
    <section className="ledger-screen">
      <div className="ledger-hero">
        <span className="eyebrow">Ledger baseline</span>
        <h1>Current balance and ordered history from persisted local state.</h1>
        <p className="lede">
          This baseline confirms what is already stored on device before new captures are added.
          History is rendered with deterministic ordering for consistent restart/reload behavior.
        </p>

        <ul className="hero-points" aria-label="Account baseline details">
          <li>
            <span className="point-icon">A</span>
            <div>
              <strong>{account.bankName}</strong>
              Account number: {account.accountNumber}
            </div>
          </li>
          <li>
            <span className="point-icon">B</span>
            <div>
              <strong>Current balance</strong>
              {formatMinorUnits(account.currentBalanceMinor)}
            </div>
          </li>
          <li>
            <span className="point-icon">O</span>
            <div>
              <strong>Ordering</strong>
              {baseline.ordering}
            </div>
          </li>
        </ul>
      </div>

      <div className="ledger-card">
        <div className="ledger-card-header">
          <h2>Transaction history</h2>
          {onRefresh ? (
            <button className="secondary-action" type="button" onClick={() => void onRefresh()}>
              Refresh baseline
            </button>
          ) : null}
        </div>

        {baseline.entries.length === 0 ? (
          <div className="empty-history" role="status">
            No ledger entries are stored yet for this account.
          </div>
        ) : (
          <ol className="history-list" aria-label="Ordered account transaction history">
            {baseline.entries.map((entry) => (
              <li key={entry.id} className="history-item">
                <div>
                  <strong>{humanizeEntryKind(entry.entryKind)}</strong>
                  <div className="history-meta">Entry #{entry.id} - {entry.createdAt}</div>
                </div>
                <div className="history-amount">{formatMinorUnits(entry.amountMinor)}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function formatMinorUnits(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function humanizeEntryKind(entryKind: string): string {
  return entryKind
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
