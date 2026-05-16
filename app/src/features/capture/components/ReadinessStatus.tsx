import {
  type AccountMismatchResolution,
  type BlockedFieldReason,
  blockedFieldReasonSchema,
  computeReadinessLabel,
  type DuplicateDecision,
  getFieldDisplayName,
  formatCurrency,
  parsePreviewSchema,
  saveGateDecisionDetailsSchema,
  type ParsePreviewViewModel,
} from "../schema";
import { AccountMismatchResolver } from "./AccountMismatchResolver";
import { DuplicateFlagIndicator } from "./DuplicateFlagIndicator";
import type {
  CommandError,
  ParsePreviewData,
  SaveTransactionAttemptData,
} from "../service";

type ReadinessStatusProps = {
  preview: ParsePreviewData | null;
  error: CommandError | null;
  saveError: CommandError | null;
  saveResult: SaveTransactionAttemptData | null;
  blockedFields: ReadonlyArray<BlockedFieldReason>;
  onOpenCorrection: () => void;
  hasCorrectionsApplied: boolean;
  mismatchResolution: AccountMismatchResolution | null;
  duplicateDecision: DuplicateDecision | null;
  onMismatchResolutionChange: (value: AccountMismatchResolution) => void;
  onDuplicateDecisionChange: (value: DuplicateDecision) => void;
  preflightAccountMismatch?: {
    detected: boolean;
    requiresResolution: boolean;
    parsedBankName?: string | null;
    parsedAccountNumber?: string | null;
    selectedBankName: string;
    selectedAccountNumber: string;
  } | null;
};

export function ReadinessStatus({
  preview,
  error,
  saveError,
  saveResult,
  blockedFields,
  onOpenCorrection,
  hasCorrectionsApplied,
  mismatchResolution,
  duplicateDecision,
  onMismatchResolutionChange,
  onDuplicateDecisionChange,
  preflightAccountMismatch,
}: ReadinessStatusProps) {
  const parsedPreview = preview ? parsePreviewSchema.safeParse(preview) : null;
  
  if (!parsedPreview?.success) {
    if (preview) {
      return (
        <section className="ledger-card capture-card" aria-live="polite">
          <h2>Readiness status</h2>
          <div className="status-banner" role="alert">
            <strong>Parse data validation failed. This may indicate a schema mismatch.</strong>
            <div>Contact support if this issue persists.</div>
          </div>
        </section>
      );
    }
  }
  
  const viewModel: ParsePreviewViewModel | null = parsedPreview?.success ? parsedPreview.data : null;

  const blockedFieldsRaw = saveError?.details?.blockedFields;
  const blockedFieldParse = blockedFieldReasonSchema.array().safeParse(blockedFieldsRaw);
  const saveBlockedFields = blockedFieldParse.success ? blockedFieldParse.data : [];
  const saveGateDetailsParse = saveGateDecisionDetailsSchema.safeParse(saveError?.details);
  const saveGateDetails = saveGateDetailsParse.success ? saveGateDetailsParse.data : null;
  const accountMismatchSignal = saveGateDetails?.accountMismatch ?? preflightAccountMismatch;
  const duplicateCandidateSignal = saveGateDetails?.duplicateCandidate;

  if (error) {
    return (
      <section className="ledger-card capture-card" aria-live="polite">
        <h2>Readiness status</h2>
        <div className="status-banner" role="alert">
          <strong>{error.message}</strong>
          {error.hint ? <div>{error.hint}</div> : null}
          <div>Guided next action: paste the full bank message with amount, direction, and date.</div>
        </div>
        <div className="blocked-reasons">
          <strong>State:</strong> Parse failed. Saving remains disabled until a safe parse preview is available.
        </div>
      </section>
    );
  }

  if (!viewModel) {
    return (
      <section className="ledger-card capture-card" aria-live="polite">
        <h2>Readiness status</h2>
        <div className="empty-history" role="status">
          No parse preview yet. Paste a bank message to evaluate readiness.
        </div>
      </section>
    );
  }

  const fields: Array<[string, string | number | null]> = [
    ["Amount", viewModel.amountMinor ? formatCurrency(viewModel.amountMinor) : null],
    ["Direction", viewModel.direction],
    ["Date", viewModel.transactionDate],
    ["Bank", viewModel.bankName],
    ["Account", viewModel.accountNumber],
    ["Merchant/Payee", viewModel.merchantOrPayee],
  ];

  return (
    <section className="ledger-card capture-card" aria-live="polite">
      <h2>Readiness status</h2>
      <div className="success-banner" role="status">
        <strong>State: {computeReadinessLabel(viewModel.readinessState)}</strong>
        <div>
          Non-color cue: {viewModel.readinessState === "ready" ? "All critical fields detected." : "One or more critical fields need review."}
        </div>
      </div>

      <ul className="capture-field-list" aria-label="Parsed critical field status">
        {fields.map(([label, value]) => (
          <li key={label} className="history-item">
            <div>
              <strong>{label}</strong>
              <div className="history-meta">{value === null ? "Missing" : "Present"}</div>
            </div>
            <div className="history-amount">{value === null ? "-" : String(value)}</div>
          </li>
        ))}
      </ul>

      {viewModel.readinessState !== "ready" ? (
        <div className="blocked-reasons">
          Saving stays blocked until all critical fields are valid. Open guided corrections to edit only blocked fields.
          {blockedFields.length > 0 ? (
            <ul aria-label="Current blocked field list">
              {blockedFields.map((item) => (
                <li key={`${item.field}-${item.reason}`}>
                  {getFieldDisplayName(item.field)}: {item.reason === "missing" ? "missing" : "ambiguous"}. {item.hint}
                </li>
              ))}
            </ul>
          ) : null}
          {blockedFields.length > 0 ? (
            <div className="submit-row">
              <button className="secondary-action" type="button" onClick={onOpenCorrection}>
                Open guided corrections
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="hint">Parse preview is ready. Save validation is available and runs before any write attempt.</div>
      )}

      {hasCorrectionsApplied ? (
        <div className="hint">Correction values are active in-memory and will be used for save retry validation.</div>
      ) : null}

      {saveError ? (
        <div className="status-banner" role="alert">
          <strong>{saveError.message}</strong>
          {saveError.hint ? <div>{saveError.hint}</div> : null}
          {accountMismatchSignal?.detected ? (
            <div>
              Non-color cue: Account mismatch resolution is required before save validation can proceed.
            </div>
          ) : null}
          {duplicateCandidateSignal?.detected ? (
            <div>
              Non-color cue: Duplicate decision is required before save validation can proceed.
            </div>
          ) : null}
          {saveBlockedFields.length > 0 ? (
            <ul className="capture-field-list" aria-label="Blocked fields from save validation">
              {saveBlockedFields.map((item) => (
                <li key={`${item.field}-${item.reason}`} className="history-item">
                  <div>
                    <strong>{getFieldDisplayName(item.field)}</strong>
                    <div className="history-meta">{item.reason === "missing" ? "Missing" : "Ambiguous"}</div>
                  </div>
                  <div className="history-meta">{item.hint}</div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {accountMismatchSignal?.detected ? (
        <AccountMismatchResolver
          value={mismatchResolution}
          parsedBankName={accountMismatchSignal.parsedBankName}
          parsedAccountNumber={accountMismatchSignal.parsedAccountNumber}
          selectedBankName={accountMismatchSignal.selectedBankName}
          selectedAccountNumber={accountMismatchSignal.selectedAccountNumber}
          onChange={onMismatchResolutionChange}
        />
      ) : null}

      {duplicateCandidateSignal?.detected ? (
        <DuplicateFlagIndicator
          value={duplicateDecision}
          reason={duplicateCandidateSignal.reason}
          fingerprint={duplicateCandidateSignal.fingerprint}
          onChange={onDuplicateDecisionChange}
        />
      ) : null}

      {saveResult ? (
        <div className="success-banner" role="status">
          <strong>Save gate result: {saveResult.validationState}</strong>
          <div>{saveResult.message}</div>
          <div>
            Deterministic scope note: validation passed, but no transaction row is written in this story phase.
          </div>
        </div>
      ) : null}
    </section>
  );
}
