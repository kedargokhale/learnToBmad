import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
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
  initialValues?: Partial<AccountSetupFormValues>;
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
  initialValues,
  submitAccount = createLedgerAccount,
  onAccountCreated,
}: AccountSetupScreenProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverHint, setServerHint] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<CreateAccountData | null>(null);
  const resolvedInitialValues = useMemo<AccountSetupFormValues>(() => ({
    bankName: initialValues?.bankName ?? "",
    accountNumber: initialValues?.accountNumber ?? "",
    openingBalance: initialValues?.openingBalance ?? "",
  }), [initialValues?.accountNumber, initialValues?.bankName, initialValues?.openingBalance]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<AccountSetupFormValues>({
    resolver: zodResolver(accountSetupSchema),
    mode: "onChange",
    defaultValues: resolvedInitialValues,
  });

  useEffect(() => {
    reset(resolvedInitialValues);
  }, [reset, resolvedInitialValues]);

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
    reset(resolvedInitialValues);
    await onAccountCreated?.(result.data);
  });

  return (
    <section className="account-setup-overlay" role="dialog" aria-modal="true" aria-labelledby="account-setup-title">
      <div className="ledger-card account-setup-dialog">
        <div className="account-setup-header">
          <span className="eyebrow">Save-triggered account confirmation</span>
          <h1 id="account-setup-title">Confirm the account and starting balance before the first write.</h1>
          <p className="section-copy">
            Save found a parsed account that is not in the local ledger yet. Confirm the account details
            once, create the local baseline, then retry save validation.
          </p>
        </div>

        <div className="account-setup-summary" aria-label="Safety checks included in this flow">
          <div className="account-setup-summary-item">
            <strong>Deterministic account key</strong>
            <span>Bank name and account number stay paired as one local identity.</span>
          </div>
          <div className="account-setup-summary-item">
            <strong>Explicit opening entry</strong>
            <span>The starting balance is stored as a real ledger entry, not an inferred shortcut.</span>
          </div>
          <div className="account-setup-summary-item">
            <strong>Safe retry path</strong>
            <span>After creation, save validation can continue against the intended account.</span>
          </div>
        </div>

        <h2>Account confirmation</h2>
        <p className="section-copy">
          Use the confirmed details from the pasted transaction context. Confirmation stays local and
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