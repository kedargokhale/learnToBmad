import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReadinessStatus } from "./components/ReadinessStatus";
import { TransactionInput } from "./components/TransactionInput";
import type {
  CommandError,
  ParsePreviewData,
  ParsePreviewEnvelope,
  SaveTransactionAttemptData,
  SaveTransactionAttemptEnvelope,
} from "./service";

function CaptureHarness({
  parseMessage,
  saveAttempt,
}: {
  parseMessage: (payload: { message: string }) => Promise<ParsePreviewEnvelope>;
  saveAttempt?: () => Promise<SaveTransactionAttemptEnvelope>;
}) {
  const [preview, setPreview] = useState<ParsePreviewData | null>(null);
  const [error, setError] = useState<CommandError | null>(null);
  const [saveError, setSaveError] = useState<CommandError | null>(null);
  const [saveResult, setSaveResult] = useState<SaveTransactionAttemptData | null>(null);
  const [ledgerSnapshot, setLedgerSnapshot] = useState("Ledger entries: 1");

  const blockedReasons = preview
    ? [
        preview.amountMinor === null ? "Amount: missing. Parse or enter the transaction amount from the source message." : null,
        preview.direction === null ? "Direction: missing. Direction must be debit or credit." : null,
        preview.transactionDate === null ? "Transaction date: missing. Provide transaction date in YYYY-MM-DD." : null,
        preview.bankName === null ? "Bank: missing. Provide the bank name from the source message." : null,
        preview.accountNumber === null
          ? "Account: missing. Provide the masked account/card identifier from the source message."
          : null,
        preview.merchantOrPayee === null
          ? "Merchant/Payee: missing. Provide the merchant or payee from the source message."
          : null,
      ].filter((value): value is string => value !== null)
    : ["Amount: missing. Parse or enter the transaction amount from the source message."];

  return (
    <>
      <TransactionInput
        parseMessage={parseMessage}
        onPreviewChange={(nextPreview, nextError) => {
          setPreview(nextPreview);
          setError(nextError);
          setSaveError(null);
          setSaveResult(null);
        }}
        saveBlockedReasons={blockedReasons}
        onAttemptSave={async () => {
          if (!saveAttempt) {
            return;
          }

          const result = await saveAttempt();
          if (!result.ok) {
            setSaveError(result.error);
            return;
          }

          setSaveResult(result.data);
          if (result.data.acceptedForWrite) {
            setLedgerSnapshot("Ledger entries: 2");
          }
        }}
      />
      <ReadinessStatus preview={preview} error={error} saveError={saveError} saveResult={saveResult} />
      <div aria-label="ledger snapshot">{ledgerSnapshot}</div>
    </>
  );
}

describe("Capture parse UX", () => {
  it("keeps legacy baseline readiness states stable for manually tested envelopes", async () => {
    const user = userEvent.setup();
    const parseMessage = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: {
          rawText: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
          normalizedText: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
          amountMinor: 125050,
          direction: "debit",
          transactionDate: "2026-05-01",
          bankName: "HDFC Bank",
          accountNumber: "XX1234",
          merchantOrPayee: "BigBazaar",
          readinessState: "ready",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          rawText: "Salary Credited! INR 5,00,000.00 to HDFC Bank A/c XX9410 Bal: INR 2,62,501.16",
          normalizedText: "Salary Credited! INR 5,00,000.00 to HDFC Bank A/c XX9410 Bal: INR 2,62,501.16",
          amountMinor: 50000000,
          direction: "credit",
          transactionDate: null,
          bankName: "HDFC Bank",
          accountNumber: "XX9410",
          merchantOrPayee: null,
          readinessState: "needs-review",
        },
      });

    render(<CaptureHarness parseMessage={parseMessage} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.");
    expect(await screen.findByText(/state: ready for validation/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/bank message/i));
    await user.paste("Salary Credited! INR 5,00,000.00 to HDFC Bank A/c XX9410 Bal: INR 2,62,501.16");
    expect(await screen.findByText(/state: needs review before save/i)).toBeInTheDocument();

    expect(parseMessage).toHaveBeenCalledTimes(2);
  });

  it("shows parse-ready feedback for a supported message", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
        normalizedText: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "HDFC Bank",
        accountNumber: "XX1234",
        merchantOrPayee: "BigBazaar",
        readinessState: "ready",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.");

    await waitFor(() => {
      expect(parseMessage).toHaveBeenCalled();
    });

    expect(await screen.findByText(/state: ready for validation/i)).toBeInTheDocument();
    expect(screen.getByText(/all critical fields detected/i)).toBeInTheDocument();
  });

  it("shows parse-failure guidance for malformed messages", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "PARSE_FAILED",
        message: "The pasted message format is not supported for safe parsing.",
        hint: "Paste the complete bank SMS/email text including amount, direction, and date.",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("Unsupported sample");

    expect(await screen.findByRole("alert")).toHaveTextContent(/not supported for safe parsing/i);
    expect(screen.getByText(/guided next action/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save transaction/i })).toBeDisabled();
  });

  it("renders the same readiness result when pasting identical text twice", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "ICICI Bank Msg: INR 5000 credited to account 9988 on 01/05/2026 from ACME PAYROLL.",
        normalizedText: "ICICI Bank Msg: INR 5000 credited to account 9988 on 01/05/2026 from ACME PAYROLL.",
        amountMinor: 500000,
        direction: "credit",
        transactionDate: "01/05/2026",
        bankName: "ICICI Bank",
        accountNumber: "9988",
        merchantOrPayee: "ACME PAYROLL",
        readinessState: "ready",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("ICICI Bank Msg: INR 5000 credited to account 9988 on 01/05/2026 from ACME PAYROLL.");

    const firstStateText = (await screen.findByText(/state: ready for validation/i)).textContent;
    const firstMerchantText = screen.getAllByText(/acme payroll/i).at(-1)?.textContent;

    await user.clear(screen.getByLabelText(/bank message/i));
    await user.paste("ICICI Bank Msg: INR 5000 credited to account 9988 on 01/05/2026 from ACME PAYROLL.");

    await waitFor(() => {
      expect(parseMessage).toHaveBeenCalledTimes(2);
    });

    const secondStateText = (await screen.findByText(/state: ready for validation/i)).textContent;
    const secondMerchantText = screen.getAllByText(/acme payroll/i).at(-1)?.textContent;

    expect(firstStateText).toBe(secondStateText);
    expect(firstMerchantText).toBe(secondMerchantText);
  });

  it("shows needs-review feedback when optional fields are missing", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "debited INR 1250.50 on 2026-05-01",
        normalizedText: "debited INR 1250.50 on 2026-05-01",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: null,
        accountNumber: null,
        merchantOrPayee: null,
        readinessState: "needs-review",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("debited INR 1250.50 on 2026-05-01");

    expect(await screen.findByText(/state: needs review before save/i)).toBeInTheDocument();
    expect(screen.getByText(/one or more critical fields need review/i)).toBeInTheDocument();
  });

  it("returns deterministic error envelopes for distinct malformed samples", async () => {
    const user = userEvent.setup();
    
    const sample1Error = {
      code: "PARSE_FAILED",
      message: "The pasted message format is not supported for safe parsing.",
      hint: "Paste the complete bank SMS/email text including amount, direction, and date.",
    };
    
    const sample2Error = {
      code: "PARSE_FAILED",
      message: "The pasted message format is not supported for safe parsing.",
      hint: "Paste the complete bank SMS/email text including amount, direction, and date.",
    };

    const parseMessage = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: sample1Error })
      .mockResolvedValueOnce({ ok: false, error: sample2Error });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("No amount or direction here");

    let firstError = await screen.findByRole("alert");
    expect(firstError).toHaveTextContent(/not supported for safe parsing/i);

    await user.clear(screen.getByLabelText(/bank message/i));
    await user.paste("Also malformed but different");

    let secondError = await screen.findByRole("alert");
    expect(secondError).toHaveTextContent(/not supported for safe parsing/i);
    
    expect(parseMessage).toHaveBeenCalledTimes(2);
  });

  it("shows blocked save reasons and keeps save disabled when critical fields are missing", async () => {
    const user = userEvent.setup();
    const saveAttempt = vi.fn();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "debited INR 1250.50 on 2026-05-01",
        normalizedText: "debited INR 1250.50 on 2026-05-01",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: null,
        accountNumber: null,
        merchantOrPayee: null,
        readinessState: "needs-review",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("debited INR 1250.50 on 2026-05-01");

    const saveButton = screen.getByRole("button", { name: /save transaction/i });
    expect(saveButton).toBeDisabled();
    expect(await screen.findByText(/save blocked until all critical fields are valid/i)).toBeInTheDocument();
    expect(screen.getByText(/bank: missing/i)).toBeInTheDocument();
    expect(saveAttempt).not.toHaveBeenCalled();
  });

  it("shows deterministic blocked-save details and keeps ledger view unchanged", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at ambiguous merchant.",
        normalizedText: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at ambiguous merchant.",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "HDFC Bank",
        accountNumber: "XX1234",
        merchantOrPayee: "BIGBAZAAR",
        readinessState: "ready",
      },
    });

    const saveAttempt = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Critical fields are missing or ambiguous. Save is blocked.",
        hint: "Review each field and re-parse or correct values before saving.",
        details: {
          blockedFields: [
            {
              field: "merchantOrPayee",
              reason: "ambiguous",
              hint: "Replace placeholder merchant/payee text with an explicit value.",
            },
          ],
        },
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at ambiguous merchant.");

    const saveButton = await screen.findByRole("button", { name: /save transaction/i });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(/critical fields are missing or ambiguous/i);
    expect(screen.getAllByText(/merchant\/payee/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/ledger snapshot/i)).toHaveTextContent("Ledger entries: 1");
  });
});
