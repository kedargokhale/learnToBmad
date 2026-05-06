import { useRef, useState } from "react";

import {
  parseTransactionMessage,
  type CommandError,
  type ParsePreviewData,
  type ParsePreviewEnvelope,
} from "../service";

type TransactionInputProps = {
  parseMessage?: (payload: { message: string }) => Promise<ParsePreviewEnvelope>;
  onPreviewChange?: (preview: ParsePreviewData | null, error: CommandError | null) => void;
};

export function TransactionInput({
  parseMessage = parseTransactionMessage,
  onPreviewChange,
}: TransactionInputProps) {
  const [message, setMessage] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const sequenceRef = useRef(0);

  async function runParse(input: string) {
    const normalized = input.trim();
    if (!normalized) {
      setFieldError("Paste the full bank message before parsing.");
      onPreviewChange?.(null, {
        code: "VALIDATION_FAILED",
        message: "Paste the full bank message before parsing.",
        hint: "Use the original message text from your bank alert.",
      });
      return;
    }

    const sequence = ++sequenceRef.current;
    setFieldError(null);
    setIsParsing(true);

    try {
      const result = await parseMessage({ message: normalized });
      
      if (sequence !== sequenceRef.current) {
        return;
      }

      if (!result.ok) {
        onPreviewChange?.(null, result.error);
        return;
      }

      if (!result.data) {
        onPreviewChange?.(null, {
          code: "PARSE_ERROR",
          message: "Parse succeeded but returned no data. This may indicate a backend issue.",
          hint: "Retry parsing the message.",
        });
        return;
      }

      onPreviewChange?.(result.data, null);
    } catch {
      if (sequence !== sequenceRef.current) {
        return;
      }
      
      onPreviewChange?.(null, {
        code: "PARSE_FAILED",
        message: "Parse preview failed before a safe result could be produced.",
        hint: "Retry by pasting the complete message text.",
      });
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <section className="ledger-card capture-card">
      <h2>Paste-to-parse capture</h2>
      <p className="section-copy">
        Paste a full bank message to extract critical fields locally. This step only previews parse readiness and never saves transactions.
      </p>

      <div className="field">
        <label htmlFor="transactionMessage">Bank message</label>
        <textarea
          id="transactionMessage"
          className="capture-textarea"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onPaste={(event) => {
            const pastedText = event.clipboardData.getData("text");
            event.preventDefault();
            setMessage(pastedText);
            void runParse(pastedText);
          }}
          aria-invalid={Boolean(fieldError)}
          placeholder="Paste the bank SMS/email text here"
        />
        <div className="hint">Paste triggers parse automatically. You can also run parse manually after editing.</div>
        {fieldError ? <div className="field-error">{fieldError}</div> : null}
      </div>

      <div className="submit-row">
        <button
          className="primary-action"
          type="button"
          disabled={isParsing}
          onClick={() => {
            void runParse(message);
          }}
        >
          {isParsing ? "Parsing message..." : "Parse message"}
        </button>
        <div className="submit-caption">Parse results update readiness immediately without mutating local ledger data.</div>
      </div>
    </section>
  );
}
