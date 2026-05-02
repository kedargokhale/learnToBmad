import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import {
  accountSetupSchema,
  parseCurrencyToMinorUnits,
  type AccountSetupFormValues,
} from "../schema";
import {
  createLedgerAccount,
  type CommandEnvelope,
  type CreateAccountData,
} from "../service";

type AccountSetupScreenProps = {
  submitAccount?: (
    payload: {
      bankName: string;
      accountNumber: string;
      openingBalanceMinor: number;
    },
  ) => Promise<CommandEnvelope<CreateAccountData>>;
  onAccountCreated?: (created: CreateAccountData) => void | Promise<void>;
};

export function AccountSetupScreen({
  submitAccount = createLedgerAccount,
  onAccountCreated,
}: AccountSetupScreenProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverHint, setServerHint] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<CreateAccountData | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<AccountSetupFormValues>({
    resolver: zodResolver(accountSetupSchema),
    mode: "onChange",
    defaultValues: {
      bankName: "",
      accountNumber: "",
      openingBalance: "",
    },
  });

  const watchedValues = watch();
  const blockedReasons = useMemo(() => {
    const reasons: string[] = [];

    if (!watchedValues.bankName?.trim()) {
      reasons.push("Confirm the bank name before the ledger can be created.");
    }

    if (!watchedValues.accountNumber?.trim()) {
      reasons.push("Confirm the account number so the account stays uniquely identified.");
    }

    if (!watchedValues.openingBalance?.trim()) {
      reasons.push("Enter an opening balance to anchor the ledger's first entry.");
    }

    return reasons;
  }, [watchedValues.accountNumber, watchedValues.bankName, watchedValues.openingBalance]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setServerHint(null);
    setSuccessState(null);

    const result = await submitAccount({
      bankName: values.bankName.trim(),
      accountNumber: values.accountNumber.trim(),
      openingBalanceMinor: parseCurrencyToMinorUnits(values.openingBalance),
    });

    if (!result.ok) {
      setServerError(result.error.message);
      setServerHint(result.error.hint ?? null);
      return;
    }

    setSuccessState(result.data);
    reset({ bankName: "", accountNumber: "", openingBalance: "" });
    await onAccountCreated?.(result.data);
  });

  return (
    <section className="ledger-screen">
      <div className="ledger-hero">
        <span className="eyebrow">First-run ledger setup</span>
        <h1>Confirm the account once. Start the ledger from a known balance.</h1>
        <p className="lede">
          This setup creates one local account record and one opening balance entry. Nothing is saved
          until the bank, account number, and starting amount are explicit.
        </p>

        <ul className="hero-points" aria-label="Safety checks included in this flow">
          <li>
            <span className="point-icon">1</span>
            <div>
              <strong>Composite account identity</strong>
              Bank name and account number are stored as one deterministic account key.
            </div>
          </li>
          <li>
            <span className="point-icon">2</span>
            <div>
              <strong>Opening balance becomes a ledger entry</strong>
              The ledger starts with an explicit opening entry instead of a mutable shortcut.
            </div>
          </li>
          <li>
            <span className="point-icon">3</span>
            <div>
              <strong>Keyboard-first blocking reasons</strong>
              Missing fields and duplicate accounts are explained before unsafe writes can happen.
            </div>
          </li>
        </ul>
      </div>

      <div className="ledger-card">
        <h2>Account setup</h2>
        <p className="section-copy">
          Use the confirmed details from the pasted transaction context. The save action stays local and
          deterministic.
        </p>

        <form className="setup-form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="bankName">Bank name</label>
            <input id="bankName" type="text" autoComplete="off" aria-invalid={Boolean(errors.bankName)} {...register("bankName")} />
            <div className="hint">Use the bank label exactly as it appears in the pasted message.</div>
            {errors.bankName ? <div className="field-error">{errors.bankName.message}</div> : null}
          </div>

          <div className="field">
            <label htmlFor="accountNumber">Account number</label>
            <input id="accountNumber" type="text" inputMode="text" autoComplete="off" aria-invalid={Boolean(errors.accountNumber)} {...register("accountNumber")} />
            <div className="hint">Include only the stable identifier needed to distinguish this account.</div>
            {errors.accountNumber ? <div className="field-error">{errors.accountNumber.message}</div> : null}
          </div>

          <div className="field">
            <label htmlFor="openingBalance">Opening balance</label>
            <input id="openingBalance" type="text" inputMode="decimal" autoComplete="off" placeholder="0.00" aria-invalid={Boolean(errors.openingBalance)} {...register("openingBalance")} />
            <div className="hint">Enter the amount in major units. It will be stored in integer minor units.</div>
            {errors.openingBalance ? <div className="field-error">{errors.openingBalance.message}</div> : null}
          </div>

          {blockedReasons.length > 0 ? (
            <div className="blocked-reasons" aria-live="polite">
              Save is blocked until these details are complete:
              <ul>
                {blockedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {serverError ? (
            <div className="status-banner" role="alert">
              <strong>{serverError}</strong>
              {serverHint ? <div>{serverHint}</div> : null}
            </div>
          ) : null}

          {successState ? (
            <div className="success-banner" role="status">
              <strong>Ledger created locally.</strong>
              <ul className="success-metadata">
                <li>Account #{successState.accountId} is ready for forward-only entries.</li>
                <li>Opening ledger entry #{successState.openingEntryId} stored {formatMinorUnits(successState.openingBalanceMinor)}.</li>
              </ul>
            </div>
          ) : null}

          <div className="submit-row">
            <button className="primary-action" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving account..." : "Create account and opening balance"}
            </button>
            <div className="submit-caption">Blocked states explain exactly what still needs attention.</div>
          </div>
        </form>
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