import { useState } from "react";
import type {
  LedgerAccountData,
  LedgerBaselineData,
  LedgerScopeSelection,
  LedgerScopeSummaryData,
} from "../service";
import {
  CATEGORY_TAXONOMY,
  categoryLabel,
  type CategoryCode,
} from "../../categorization/schema";
import { InsightSummary } from "../../dashboard/components/InsightSummary";
import { RunningBalanceView } from "../../dashboard/components/RunningBalanceView";
import { AccountScopeSwitcher } from "./AccountScopeSwitcher";

type LedgerBaselineViewProps = {
  baseline: LedgerBaselineData | null;
  currentScope: LedgerScopeSelection;
  onScopeChange: (scope: LedgerScopeSelection) => void;
  onRefresh?: () => Promise<void>;
  onUpdateCategory?: (transactionId: number, finalCategory: CategoryCode) => Promise<void>;
};

export function LedgerBaselineView({
  baseline,
  currentScope,
  onScopeChange,
  onRefresh,
  onUpdateCategory,
}: LedgerBaselineViewProps) {
  if (!baseline) {
    return null;
  }

  const accounts = baseline.accounts ?? (baseline.account ? [baseline.account] : []);
  const scope = resolveScopeSummary(baseline, accounts);
  const runningBalance = baseline.runningBalance;
  const insightSummary = baseline.insightSummary ?? [];
  const [draftCategories, setDraftCategories] = useState<Record<number, CategoryCode>>({});
  const [updatingTransactionId, setUpdatingTransactionId] = useState<number | null>(null);

  if (accounts.length === 0) {
    return null;
  }

  return (
    <section className="ledger-screen">
      <div className="ledger-hero">
        <span className="eyebrow">{scope.label}</span>
        <h1>Current balance and ordered history from persisted local state.</h1>
        <p className="lede">
          This baseline confirms what is already stored on device before new captures are added.
          History is rendered with deterministic ordering for consistent restart/reload behavior.
        </p>

        <ul className="hero-points" aria-label="Account baseline details">
          <li>
            <span className="point-icon">A</span>
            <div>
              <strong>Scope</strong>
              {scope.label}
            </div>
          </li>
          <li>
            <span className="point-icon">B</span>
            <div>
              <strong>Current balance</strong>
              {formatMinorUnits(scope.currentBalanceMinor)}
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

        <AccountScopeSwitcher
          accounts={accounts}
          currentScope={currentScope}
          scopeLabel={scope.label}
          onScopeChange={onScopeChange}
        />
      </div>

      <div className="ledger-card">
        <InsightSummary cards={insightSummary} />

        <section className="insight-summary" aria-label="Running balance insights">
          <RunningBalanceView runningBalance={runningBalance} />
        </section>

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
            No ledger entries are stored yet for this scope.
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

function resolveScopeSummary(
  baseline: LedgerBaselineData,
  accounts: LedgerAccountData[],
): LedgerScopeSummaryData {
  if (baseline.scope) {
    return baseline.scope;
  }

  if (baseline.account) {
    return {
      kind: "account",
      label: `${baseline.account.bankName} - ${baseline.account.accountNumber}`,
      accountId: baseline.account.id,
      accountCount: accounts.length || 1,
      currentBalanceMinor: baseline.account.currentBalanceMinor,
    };
  }

  return {
    kind: "all-accounts",
    label: "All accounts",
    accountCount: accounts.length,
    currentBalanceMinor: accounts.reduce((total, accountItem) => total + accountItem.currentBalanceMinor, 0),
  };
}

