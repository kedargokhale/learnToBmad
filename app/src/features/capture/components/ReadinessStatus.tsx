import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type AccountMismatchResolution,
  type BlockedFieldReason,
  blockedFieldReasonSchema,
  deriveCaptureSemanticState,
  type DuplicateDecision,
  getFieldDisplayName,
  formatCurrency,
  getCaptureSemanticStateCue,
  getCaptureSemanticStateLabel,
  parsePreviewSchema,
  getSaveLifecycleLabel,
  saveGateDecisionDetailsSchema,
  type SaveLifecycleState,
  type ParsePreviewViewModel,
  type CategorySource,
} from "../schema";
import {
  CATEGORY_TAXONOMY,
  categoryLabel,
  type CategoryCode,
} from "../../categorization/schema";
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
  saveLifecycleState: SaveLifecycleState;
  selectedCategory: CategoryCode;
  onCategoryChange: (value: CategoryCode) => void;
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
  saveLifecycleState,
  selectedCategory,
  onCategoryChange,
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
  const accountMismatchSignal = saveGateDetails?.accountMismatch
    ? {
        ...saveGateDetails.accountMismatch,
        requiresResolution:
          saveGateDetails.accountMismatch.requiresResolution ||
          Boolean(preflightAccountMismatch?.requiresResolution),
      }
    : preflightAccountMismatch;
  const duplicateCandidateSignal = saveGateDetails?.duplicateCandidate;
  const requiresMismatchResolution = Boolean(
    accountMismatchSignal?.requiresResolution && !mismatchResolution,
  );
  const requiresDuplicateDecision = Boolean(duplicateCandidateSignal?.detected && duplicateCandidateSignal.requiresDecision && !duplicateDecision);
  const detailsIssueTriggered = Boolean(
    viewModel?.readinessState !== "ready" ||
      blockedFields.length > 0 ||
      saveError ||
      requiresMismatchResolution ||
      requiresDuplicateDecision,
  );
  const disclosureResetKey = useMemo(() => {
    if (!viewModel) {
      return "no-preview";
    }

    return [
      viewModel.normalizedText,
      viewModel.amountMinor,
      viewModel.direction,
      viewModel.transactionDate,
      viewModel.bankName,
      viewModel.accountNumber,
      viewModel.merchantOrPayee,
      detailsIssueTriggered,
    ].join("|");
  }, [detailsIssueTriggered, viewModel]);
  const [showDetails, setShowDetails] = useState(detailsIssueTriggered);
  const detailsToggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setShowDetails(detailsIssueTriggered);
  }, [detailsIssueTriggered, disclosureResetKey]);

  function collapseDetails() {
    setShowDetails(false);
    detailsToggleRef.current?.focus();
  }

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
    ["Amount", viewModel.amountMinor === null ? null : formatCurrency(viewModel.amountMinor)],
    ["Direction", viewModel.direction],
    ["Date", viewModel.transactionDate],
    ["Bank", viewModel.bankName],
    ["Account", viewModel.accountNumber],
    ["Merchant/Payee", viewModel.merchantOrPayee],
    ["Suggested category", categoryLabel(viewModel.suggestedCategory)],
  ];
  const selectedCategorySource: CategorySource =
    selectedCategory === viewModel.suggestedCategory ? "suggested" : "user-override";
  const semanticState = deriveCaptureSemanticState({
    readinessState: viewModel.readinessState,
    requiresMismatchResolution,
    requiresDuplicateDecision,
  });
  const semanticIcon =
    semanticState === "ready"
      ? "[OK]"
      : semanticState === "needs-review"
        ? "[!]"
        : semanticState === "duplicate-flagged"
          ? "[DUP]"
          : "[X]";

  return (
    <section className="ledger-card capture-card" aria-live="polite">
      <h2>Readiness status</h2>
      {saveLifecycleState !== "idle" ? (
        <div className={saveLifecycleState === "failed" || saveLifecycleState === "blocked" ? "status-banner" : "success-banner"} role={saveLifecycleState === "failed" ? "alert" : "status"}>
          <strong>{getSaveLifecycleLabel(saveLifecycleState)}</strong>
          <div>
            {saveLifecycleState === "validating"
              ? "Checking validation gates before any write is attempted."
              : saveLifecycleState === "persisting"
                ? "The transaction row and audit trail are being written together."
                : saveLifecycleState === "success"
                  ? "Refresh completed only after the commit response returned successfully."
                  : saveLifecycleState === "blocked"
                    ? "The flow stopped before persistence because a required decision or field is still missing."
                    : "The last save attempt failed and the baseline was left unchanged."}
          </div>
        </div>
      ) : null}
      <div className={`semantic-banner semantic-banner--${semanticState}`} role="status" aria-live="polite">
        <strong>{semanticIcon} State: {getCaptureSemanticStateLabel(semanticState)}</strong>
        <div>
          Non-color cue: {getCaptureSemanticStateCue(semanticState)}
        </div>
      </div>

      <div
        onKeyDown={(event) => {
          if (event.key === "Escape" && showDetails) {
            event.preventDefault();
            collapseDetails();
          }
        }}
      >
        <div className="readiness-summary-row">
          <div className="hint">
            {detailsIssueTriggered
              ? "Detailed guidance is expanded because there are issues to resolve."
              : "Everything looks ready. Parsed field details stay hidden unless you ask for them."}
          </div>
          <button
            ref={detailsToggleRef}
            className="secondary-action"
            type="button"
            aria-expanded={showDetails}
            aria-controls="parsed-details"
            onClick={() => {
              setShowDetails((current) => !current);
            }}
          >
            {showDetails ? "Hide parsed details" : "Show parsed details"}
          </button>
        </div>

        <ul
          id="parsed-details"
          className="capture-field-list"
          aria-label="Parsed critical field status"
          hidden={!showDetails}
          aria-hidden={!showDetails}
        >
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
      </div>

      <div className="field">
        <label htmlFor="categoryOverride">Category before save</label>
        <select
          id="categoryOverride"
          value={selectedCategory}
          onChange={(event) => onCategoryChange(event.target.value as CategoryCode)}
        >
          {CATEGORY_TAXONOMY.map((category) => (
            <option key={category.code} value={category.code}>
              {category.label}
            </option>
          ))}
        </select>
        <div className="hint">
          Suggested: {categoryLabel(viewModel.suggestedCategory)}. Final for save: {categoryLabel(selectedCategory)} ({selectedCategorySource}).
        </div>
      </div>

      {viewModel.readinessState !== "ready" ? (
        <div className="blocked-reasons">
          A few details still need review before save can continue. Open guided corrections to fix only the blocked fields.
          {blockedFields.length > 0 ? (
            <ul aria-label="Current blocked field list">
              {blockedFields.map((item) => (
                <li key={`${item.field}-${item.reason}`}>
                  {getFieldDisplayName(item.field)}: {item.reason === "missing" ? "missing" : "ambiguous"}. Next safe action: {item.hint}
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
          {saveGateDetails?.nextAction ? <div>Next safe action: {saveGateDetails.nextAction}</div> : null}
          {accountMismatchSignal?.requiresResolution ? (
            <div>
              Non-color cue: Review the account mismatch, then choose how to continue safely.
            </div>
          ) : null}
          {duplicateCandidateSignal?.detected ? (
            <div>
              Non-color cue: Choose whether to save as new or skip this duplicate candidate.
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

      {accountMismatchSignal?.requiresResolution ? (
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
          <strong>Save persisted: {saveResult.validationState}</strong>
          <div>{saveResult.message}</div>
          {saveResult.persistedRecord ? (
            <div>
              Transaction #{saveResult.persistedRecord.transactionId} and audit #{saveResult.persistedRecord.auditEntryId} were committed together at {saveResult.persistedRecord.transactionCreatedAt}.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
