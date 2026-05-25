import { useMemo } from "react";

import {
  getFieldDisplayName,
  getFieldValueForCorrection,
  type BlockedFieldReason,
  type ParsePreviewViewModel,
} from "../schema";

type CorrectionPanelProps = {
  isOpen: boolean;
  blockedFields: ReadonlyArray<BlockedFieldReason>;
  preview: ParsePreviewViewModel | null;
  correctionValues: Partial<Record<BlockedFieldReason["field"], string>>;
  onCorrectionChange: (field: BlockedFieldReason["field"], value: string) => void;
  onApply: (hadBlockedFields: boolean) => void;
  onClose: () => void;
};

function getInputMeta(field: BlockedFieldReason["field"]): {
  inputType: "text" | "number";
  placeholder: string;
} {
  switch (field) {
    case "amountMinor":
      return {
        inputType: "number",
        placeholder: "Enter amount in INR, e.g. 1250.50",
      };
    case "direction":
      return {
        inputType: "text",
        placeholder: "Enter debit or credit",
      };
    case "transactionDate":
      return {
        inputType: "text",
        placeholder: "Use YYYY-MM-DD",
      };
    case "bankName":
      return {
        inputType: "text",
        placeholder: "Enter exact bank name",
      };
    case "accountNumber":
      return {
        inputType: "text",
        placeholder: "Enter masked account/card identifier",
      };
    case "merchantOrPayee":
      return {
        inputType: "text",
        placeholder: "Enter merchant or payee",
      };
  }
}

export function CorrectionPanel({
  isOpen,
  blockedFields,
  preview,
  correctionValues,
  onCorrectionChange,
  onApply,
  onClose,
}: CorrectionPanelProps) {
  const visibleBlockedFields = useMemo(() => blockedFields, [blockedFields]);
  const hasBlockedFields = visibleBlockedFields.length > 0;
  const hasEditedValues = Object.keys(correctionValues).length > 0;
  const canApplyCorrections = hasBlockedFields || hasEditedValues;

  if (!isOpen || !preview) {
    return null;
  }

  return (
    <section
      className="ledger-card capture-card"
      aria-live="polite"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }

        if (event.key === "Enter") {
          const target = event.target as HTMLElement;
          if (target.tagName.toLowerCase() !== "textarea") {
            event.preventDefault();
            if (!canApplyCorrections) {
              onClose();
              return;
            }

            onApply(true);
          }
        }
      }}
    >
      <div className="ledger-card-header">
        <h2>Guided corrections</h2>
        <button className="secondary-action" type="button" onClick={onClose}>
          Close (Esc)
        </button>
      </div>
      <p className="section-copy">
        Correct only blocked fields. Save retry unlocks automatically once all required fields are valid.
      </p>
      {hasBlockedFields ? (
        <ul className="capture-field-list" aria-label="Blocked critical fields needing correction">
          {visibleBlockedFields.map((item) => {
            const meta = getInputMeta(item.field);
            const fallbackValue = getFieldValueForCorrection(preview, item.field);
            const value = correctionValues[item.field] ?? fallbackValue;
            const inputId = `correction-${item.field}`;

            return (
              <li key={`${item.field}-${item.reason}`} className="history-item">
                <div className="field correction-field">
                  <label htmlFor={inputId}>{getFieldDisplayName(item.field)}</label>
                  <div className="history-meta">{item.reason === "missing" ? "Missing" : "Ambiguous"}</div>
                  <input
                    id={inputId}
                    type={meta.inputType}
                    inputMode={item.field === "amountMinor" ? "decimal" : undefined}
                    value={value}
                    onChange={(event) => {
                      onCorrectionChange(item.field, event.target.value);
                    }}
                    placeholder={meta.placeholder}
                  />
                  <div className="hint">{item.hint}</div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="success-banner" role="status">
          <strong>All blocked fields look complete.</strong>
          <div>
            {canApplyCorrections
              ? "Apply corrections to continue with save validation."
              : "Close this panel and continue with save validation."}
          </div>
        </div>
      )}
      <div className="submit-row">
        {canApplyCorrections ? (
          <button className="primary-action" type="button" onClick={() => onApply(true)}>
            Apply corrections (Enter)
          </button>
        ) : (
          <button className="secondary-action" type="button" onClick={onClose}>
            Close panel (Enter)
          </button>
        )}
        <div className="submit-caption">Keyboard-first flow: Tab through fields, Enter to apply, Escape to close.</div>
      </div>
    </section>
  );
}
