import type { LedgerAccountData, LedgerScopeSelection } from "../service";

type AccountScopeSwitcherProps = {
  accounts: LedgerAccountData[];
  currentScope: LedgerScopeSelection;
  scopeLabel: string;
  onScopeChange: (scope: LedgerScopeSelection) => void;
};

export function AccountScopeSwitcher({
  accounts,
  currentScope,
  scopeLabel,
  onScopeChange,
}: AccountScopeSwitcherProps) {
  if (accounts.length <= 1) {
    return null;
  }

  const currentValue = scopeSelectionToValue(currentScope);

  return (
    <section className="scope-switcher" aria-label="Account scope switcher">
      <div className="scope-switcher-copy">
        <span className="eyebrow">Scope</span>
        <strong>{scopeLabel}</strong>
        <p>Switch between the aggregated baseline and an individual account.</p>
      </div>

      <label className="field scope-switcher-control">
        <span>Active scope</span>
        <select
          value={currentValue}
          onChange={(event) => {
            onScopeChange(valueToScopeSelection(event.target.value));
          }}
          aria-label="Active ledger scope"
        >
          <option value="all-accounts">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={scopeSelectionToValue({ kind: "account", accountId: account.id })}>
              {account.bankName} - {account.accountNumber}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function scopeSelectionToValue(scope: LedgerScopeSelection): string {
  return scope.kind === "all-accounts" ? "all-accounts" : `account:${scope.accountId}`;
}

function valueToScopeSelection(value: string): LedgerScopeSelection {
  if (value === "all-accounts") {
    return { kind: "all-accounts" };
  }

  const accountId = Number.parseInt(value.split(":")[1] ?? "", 10);
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return { kind: "all-accounts" };
  }

  return {
    kind: "account",
    accountId,
  };
}
