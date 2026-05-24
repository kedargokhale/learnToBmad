import { useState } from "react";
import type { LedgerBaselineData } from "../service";
import {
  CATEGORY_TAXONOMY,
  categoryLabel,
  type CategoryCode,
} from "../../categorization/schema";
import { InsightSummary } from "../../dashboard/components/InsightSummary";

type LedgerBaselineViewProps = {
  baseline: LedgerBaselineData;
  onRefresh?: () => Promise<void>;
  onUpdateCategory?: (transactionId: number, finalCategory: CategoryCode) => Promise<void>;
};

export function LedgerBaselineView({ baseline, onRefresh, onUpdateCategory }: LedgerBaselineViewProps) {
  const account = baseline.account;
  const categoryInsights = baseline.categoryInsights ?? [];
  const merchantInsights = baseline.merchantInsights ?? [];
  const [draftCategories, setDraftCategories] = useState<Record<number, CategoryCode>>({});
  const [updatingTransactionId, setUpdatingTransactionId] = useState<number | null>(null);

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
        <InsightSummary categoryInsights={categoryInsights} merchantInsights={merchantInsights} />

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
                  {entry.finalCategory ? (
                    <div className="history-meta">
                      Category: {categoryLabel(entry.finalCategory)} ({entry.categorySource ?? "suggested"})
                    </div>
                  ) : null}
                  {entry.entryKind === "capture_transaction" && entry.captureTransactionId && onUpdateCategory ? (
                    <div className="submit-row" style={{ marginTop: 8 }}>
                      <select
                        value={draftCategories[entry.id] ?? (entry.finalCategory as CategoryCode) ?? "other"}
                        disabled={updatingTransactionId === entry.captureTransactionId}
                        onChange={(event) => {
                          setDraftCategories((current) => ({
                            ...current,
                            [entry.id]: event.target.value as CategoryCode,
                          }));
                        }}
                        aria-label={`Category for transaction ${entry.captureTransactionId}`}
                      >
                        {CATEGORY_TAXONOMY.map((category) => (
                          <option key={category.code} value={category.code}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="secondary-action"
                        type="button"
                        disabled={updatingTransactionId === entry.captureTransactionId}
                        onClick={async () => {
                          if (!entry.captureTransactionId || updatingTransactionId === entry.captureTransactionId) {
                            return;
                          }

                          const nextCategory =
                            draftCategories[entry.id] ??
                            (entry.finalCategory as CategoryCode) ??
                            "other";

                          setUpdatingTransactionId(entry.captureTransactionId);
                          try {
                            await onUpdateCategory(entry.captureTransactionId as number, nextCategory);
                          } finally {
                            setUpdatingTransactionId(null);
                          }
                        }}
                      >
                        Update category
                      </button>
                    </div>
                  ) : null}
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
