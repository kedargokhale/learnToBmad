import {
  blockedFieldReasonSchema,
  computeReadinessLabel,
  getFieldDisplayName,
  formatCurrency,
  parsePreviewSchema,
  type ParsePreviewViewModel,
} from "../schema";
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
};

export function ReadinessStatus({
  preview,
  error,
  saveError,
  saveResult,
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
  const blockedFields = blockedFieldParse.success ? blockedFieldParse.data : [];

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
          Saving is intentionally disabled in this story phase. Review missing fields and re-paste the source message.
        </div>
      ) : (
        <div className="hint">Parse preview is ready. Save validation is available and runs before any write attempt.</div>
      )}

      {saveError ? (
        <div className="status-banner" role="alert">
          <strong>{saveError.message}</strong>
          {saveError.hint ? <div>{saveError.hint}</div> : null}
          {blockedFields.length > 0 ? (
            <ul className="capture-field-list" aria-label="Blocked fields from save validation">
              {blockedFields.map((item) => (
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

      {saveResult ? (
        <div className="success-banner" role="status">
          <strong>Save gate result: {saveResult.validationState}</strong>
          <div>{saveResult.message}</div>
          <div>
            Deterministic scope note: validation passed, but write persistence remains disabled in this story.
          </div>
        </div>
      ) : null}
    </section>
  );
}
