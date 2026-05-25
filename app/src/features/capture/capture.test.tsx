import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReadinessStatus } from "./components/ReadinessStatus";
import { CorrectionPanel } from "./components/CorrectionPanel";
import { TransactionInput } from "./components/TransactionInput";
import {
  applyCorrectionMap,
  correctionMapSchema,
  deriveBlockedFieldReasons,
  deriveReadinessStateFromBlockedFields,
  getFieldDisplayName,
  parsePreviewSchema,
  saveGateDecisionDetailsSchema,
  type SaveLifecycleState,
  type BlockedFieldReason,
  resolveCategorySource,
} from "./schema";
import { type CategoryCode, isCategoryCode } from "../categorization/schema";
import type {
  SaveTransactionAttemptPayload,
  CommandError,
  ParsePreviewData,
  ParsePreviewEnvelope,
  SaveTransactionAttemptData,
  SaveTransactionAttemptEnvelope,
} from "./service";

function createPersistedRecord() {
  return {
    transactionId: 42,
    transactionFingerprint: "persisted-fingerprint-42",
    transactionCreatedAt: "2026-05-19 12:00:00",
    auditEntryId: 84,
    auditCreatedAt: "2026-05-19 12:00:01",
  };
}

function CaptureHarness({
  parseMessage,
  saveAttempt,
}: {
  parseMessage: (payload: { message: string }) => Promise<ParsePreviewEnvelope>;
  saveAttempt?: (payload: SaveTransactionAttemptPayload) => Promise<SaveTransactionAttemptEnvelope>;
}) {
  const [preview, setPreview] = useState<ParsePreviewData | null>(null);
  const [error, setError] = useState<CommandError | null>(null);
  const [saveError, setSaveError] = useState<CommandError | null>(null);
  const [saveResult, setSaveResult] = useState<SaveTransactionAttemptData | null>(null);
  const [saveLifecycleState, setSaveLifecycleState] = useState<SaveLifecycleState>("idle");
  const [ledgerSnapshot, setLedgerSnapshot] = useState("Ledger entries: 1");
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [mismatchResolution, setMismatchResolution] = useState<"use-selected-account" | "use-parsed-account" | null>(null);
  const [duplicateDecision, setDuplicateDecision] = useState<"save-as-new" | "skip-save" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryCode>("other");
  const [correctionMap, setCorrectionMap] = useState<
    Partial<Record<BlockedFieldReason["field"], string>>
  >({});

  const parsedPreview = parsePreviewSchema.safeParse(preview);
  const normalizedPreview = parsedPreview.success ? parsedPreview.data : null;
  const parsedCorrectionMap = correctionMapSchema.safeParse(correctionMap);
  const correctedPreview =
    normalizedPreview && parsedCorrectionMap.success
      ? applyCorrectionMap(normalizedPreview, parsedCorrectionMap.data)
      : normalizedPreview;
  const blockedFields = error
    ? deriveBlockedFieldReasons(null)
    : deriveBlockedFieldReasons(correctedPreview);
  const saveGateDetailsParse = saveGateDecisionDetailsSchema.safeParse(saveError?.details);
  const saveGateDetails = saveGateDetailsParse.success ? saveGateDetailsParse.data : null;
  const blockedReasons = blockedFields.map((item) => {
    const reasonLabel = item.reason === "missing" ? "missing" : "ambiguous";
    return `${getFieldDisplayName(item.field)}: ${reasonLabel}. ${item.hint}`;
  });
  if (saveGateDetails?.accountMismatch?.detected && !mismatchResolution) {
    blockedReasons.push("Account mismatch detected: choose a mismatch resolution to continue.");
  }
  if (saveGateDetails?.duplicateCandidate?.detected && !duplicateDecision) {
    blockedReasons.push("Possible duplicate detected: choose a duplicate decision to continue.");
  }
  const hasCorrectionsApplied = Object.keys(correctionMap).length > 0;

  return (
    <>
      <TransactionInput
        parseMessage={parseMessage}
        onPreviewChange={(nextPreview, nextError) => {
          setPreview(nextPreview);
          setError(nextError);
          setSaveError(null);
          setSaveResult(null);
          setSaveLifecycleState("idle");
          setIsCorrectionOpen(false);
          setMismatchResolution(null);
          setDuplicateDecision(null);
          if (nextPreview && isCategoryCode(nextPreview.finalCategory)) {
            setSelectedCategory(nextPreview.finalCategory);
          } else {
            setSelectedCategory("other");
          }
          setCorrectionMap({});
        }}
        saveBlockedReasons={blockedReasons}
        onAttemptSave={async () => {
          if (!saveAttempt) {
            return;
          }

          if (!correctedPreview || blockedFields.length > 0) {
            setSaveLifecycleState("blocked");
            return;
          }

          setSaveLifecycleState("validating");

          const result = await saveAttempt({
            accountContext: {
              accountId: 1,
              bankName: "HDFC Bank",
              accountNumber: "XX1234",
            },
            parsedPayload: {
              ...correctedPreview,
              finalCategory: selectedCategory,
              categorySource: resolveCategorySource(
                correctedPreview.suggestedCategory,
                selectedCategory,
              ),
              readinessState: deriveReadinessStateFromBlockedFields(blockedFields),
            },
            mismatchResolution,
            duplicateDecision,
          });
          if (!result.ok) {
            setSaveLifecycleState("failed");
            setSaveError(result.error);
            return;
          }

          setSaveLifecycleState("success");
          setSaveResult(result.data);
          if (result.data.acceptedForWrite) {
            setLedgerSnapshot("Ledger entries: 2");
          }
        }}
      />
      <ReadinessStatus
        preview={correctedPreview}
        error={error}
        saveError={saveError}
        saveResult={saveResult}
        blockedFields={blockedFields}
        onOpenCorrection={() => {
          if (blockedFields.length > 0) {
            setIsCorrectionOpen(true);
          }
        }}
        hasCorrectionsApplied={hasCorrectionsApplied}
        mismatchResolution={mismatchResolution}
        duplicateDecision={duplicateDecision}
        onMismatchResolutionChange={(value) => {
          setMismatchResolution(value);
          setSaveLifecycleState("idle");
        }}
        onDuplicateDecisionChange={(value) => {
          setDuplicateDecision(value);
          setSaveLifecycleState("idle");
        }}
        selectedCategory={selectedCategory}
        onCategoryChange={(value) => {
          setSelectedCategory(value);
          setSaveLifecycleState("idle");
        }}
        saveLifecycleState={saveLifecycleState}
      />
      <CorrectionPanel
        isOpen={isCorrectionOpen}
        blockedFields={blockedFields}
        preview={correctedPreview}
        correctionValues={correctionMap}
        onCorrectionChange={(field, value) => {
          setCorrectionMap((current) => ({
            ...current,
            [field]: value,
          }));
          setSaveError(null);
          setSaveResult(null);
          setSaveLifecycleState("idle");
        }}
        onApply={() => {
          setIsCorrectionOpen(false);
        }}
        onClose={() => {
          setIsCorrectionOpen(false);
        }}
      />
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
          suggestedCategory: "other",
          finalCategory: "other",
          categorySource: "suggested",
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
          suggestedCategory: "other",
          finalCategory: "other",
          categorySource: "suggested",
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

  it("accepts unknown category codes in parse preview without schema-failure state", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "HDFC Bank Alert: A/c XX1234 debited by INR 300 on 2026-05-01 at Vendor X.",
        normalizedText: "HDFC Bank Alert: A/c XX1234 debited by INR 300 on 2026-05-01 at Vendor X.",
        amountMinor: 30000,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "HDFC Bank",
        accountNumber: "XX1234",
        merchantOrPayee: "Vendor X",
        suggestedCategory: "travel-international",
        finalCategory: "travel-international",
        categorySource: "suggested",
        readinessState: "ready",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("HDFC Bank Alert: A/c XX1234 debited by INR 300 on 2026-05-01 at Vendor X.");

    expect(await screen.findByText(/state: ready for validation/i)).toBeInTheDocument();
    expect(screen.queryByText(/parse data validation failed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/suggested: travel-international/i)).toBeInTheDocument();
  });

  it("renders zero amount as present instead of missing", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "HDFC Bank Alert: A/c XX1234 debited by INR 0.00 on 2026-05-01 at Vendor X.",
        normalizedText: "HDFC Bank Alert: A/c XX1234 debited by INR 0.00 on 2026-05-01 at Vendor X.",
        amountMinor: 0,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "HDFC Bank",
        accountNumber: "XX1234",
        merchantOrPayee: "Vendor X",
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "ready",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("HDFC Bank Alert: A/c XX1234 debited by INR 0.00 on 2026-05-01 at Vendor X.");

    expect(await screen.findByText("₹0.00")).toBeInTheDocument();
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
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
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
    expect(screen.getByRole("button", { name: /run save validation/i })).toBeDisabled();
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
        transactionDate: "2026-05-01",
        bankName: "ICICI Bank",
        accountNumber: "9988",
        merchantOrPayee: "ACME PAYROLL",
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "ready",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("ICICI Bank Msg: INR 5000 credited to account 9988 on 01/05/2026 from ACME PAYROLL.");

    const firstStateText = (await screen.findByText(/state: ready for validation/i)).textContent;
    const firstMerchantMatches = screen.getAllByText(/acme payroll/i);
    const firstMerchantText = firstMerchantMatches[firstMerchantMatches.length - 1]?.textContent;

    await user.clear(screen.getByLabelText(/bank message/i));
    await user.paste("ICICI Bank Msg: INR 5000 credited to account 9988 on 01/05/2026 from ACME PAYROLL.");

    await waitFor(() => {
      expect(parseMessage).toHaveBeenCalledTimes(2);
    });

    const secondStateText = (await screen.findByText(/state: ready for validation/i)).textContent;
    const secondMerchantMatches = screen.getAllByText(/acme payroll/i);
    const secondMerchantText = secondMerchantMatches[secondMerchantMatches.length - 1]?.textContent;

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
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
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
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "needs-review",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("debited INR 1250.50 on 2026-05-01");

    const saveButton = screen.getByRole("button", { name: /run save validation/i });
    expect(saveButton).toBeDisabled();
    expect(await screen.findByText(/save blocked until all critical fields are valid/i)).toBeInTheDocument();
    expect(screen.getAllByText(/bank: missing/i).length).toBeGreaterThan(0);
    expect(saveAttempt).not.toHaveBeenCalled();
  });

  it("shows only blocked fields in guided corrections with deterministic hints", async () => {
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
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "needs-review",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("debited INR 1250.50 on 2026-05-01");

    await user.click(await screen.findByRole("button", { name: /open guided corrections/i }));

    expect(await screen.findByLabelText(/^bank$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^account$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^merchant\/payee$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^amount$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/provide the bank name from the source message/i).length).toBeGreaterThan(0);
  });

  it("shrinks blocked fields deterministically as corrections are applied", async () => {
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
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "needs-review",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("debited INR 1250.50 on 2026-05-01");

    const saveButton = screen.getByRole("button", { name: /run save validation/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByRole("list", { name: /current blocked field list/i }).querySelectorAll("li")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: /open guided corrections/i }));
    await user.type(screen.getByLabelText(/^bank$/i), "HDFC Bank");
    expect(screen.getByRole("list", { name: /current blocked field list/i }).querySelectorAll("li")).toHaveLength(2);

    await user.type(screen.getByLabelText(/^account$/i), "XX1234");
    expect(screen.getByRole("list", { name: /current blocked field list/i }).querySelectorAll("li")).toHaveLength(1);

    await user.type(screen.getByLabelText(/^merchant\/payee$/i), "BigBazaar");
    await waitFor(() => {
      expect(screen.queryByRole("list", { name: /current blocked field list/i })).not.toBeInTheDocument();
    });
    expect(saveButton).toBeEnabled();
  });

  it("keeps save retry unavailable until corrections are complete, then reuses save attempt path", async () => {
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
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "needs-review",
      },
    });
    const saveAttempt = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        validationState: "passed",
        acceptedForWrite: true,
        checkedFields: [
          "amountMinor",
          "direction",
          "transactionDate",
          "bankName",
          "accountNumber",
          "merchantOrPayee",
        ],
        message: "Validation passed and the transaction was persisted deterministically.",
        persistedRecord: createPersistedRecord(),
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("debited INR 1250.50 on 2026-05-01");

    const saveButton = screen.getByRole("button", { name: /run save validation/i });
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(saveAttempt).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /open guided corrections/i }));
    await user.type(screen.getByLabelText(/^bank$/i), "HDFC Bank");
    await user.type(screen.getByLabelText(/^account$/i), "XX1234");
    await user.type(screen.getByLabelText(/^merchant\/payee$/i), "BigBazaar");

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });

    await user.click(saveButton);
    expect(saveAttempt).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/save persisted: passed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ledger snapshot/i)).toHaveTextContent("Ledger entries: 2");
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
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
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

    const saveButton = await screen.findByRole("button", { name: /run save validation/i });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    expect(screen.getByText(/critical fields are missing or ambiguous/i)).toBeInTheDocument();
    expect(screen.getAllByText(/merchant\/payee/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/ledger snapshot/i)).toHaveTextContent("Ledger entries: 1");
  });

  it("requires explicit mismatch resolution before retrying save", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "sample",
        normalizedText: "sample",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "ICICI Bank",
        accountNumber: "XX9999",
        merchantOrPayee: "BigBazaar",
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "ready",
      },
    });

    const saveAttempt = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Critical fields are missing or ambiguous. Save is blocked.",
          hint: "Review each field and re-parse or correct values before saving.",
          details: {
            blockedFields: [
              {
                field: "accountNumber",
                reason: "ambiguous",
                hint: "Account mismatch detected. Choose a mismatch resolution before retrying save.",
              },
            ],
            accountMismatch: {
              detected: true,
              requiresResolution: true,
              parsedBankName: "ICICI Bank",
              parsedAccountNumber: "XX9999",
              selectedBankName: "HDFC Bank",
              selectedAccountNumber: "XX1234",
            },
            duplicateCandidate: {
              detected: false,
              requiresDecision: false,
              fingerprint: "125050|debit|2026-05-01|XX9999|BIGBAZAAR",
            },
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          validationState: "passed",
          acceptedForWrite: true,
          checkedFields: ["amountMinor", "direction", "transactionDate", "bankName", "accountNumber", "merchantOrPayee"],
          message: "Validation passed and the transaction was persisted deterministically.",
          persistedRecord: createPersistedRecord(),
        },
      });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("sample");

    const saveButton = await screen.findByRole("button", { name: /run save validation/i });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    expect((await screen.findAllByText(/account mismatch detected/i)).length).toBeGreaterThan(0);
    expect(saveButton).toBeDisabled();

    await user.click(screen.getByLabelText(/keep selected account and continue validation/i));
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    expect(await screen.findByText(/save persisted: passed/i)).toBeInTheDocument();
  });

  it("requires explicit duplicate decision before retrying save", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "duplicate",
        normalizedText: "duplicate",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "HDFC Bank",
        accountNumber: "XX1234",
        merchantOrPayee: "BigBazaar",
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "ready",
      },
    });

    const saveAttempt = vi
      .fn()
      .mockResolvedValueOnce({
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
                hint: "Possible duplicate detected. Choose a duplicate decision before retrying save.",
              },
            ],
            accountMismatch: {
              detected: false,
              requiresResolution: false,
              selectedBankName: "HDFC Bank",
              selectedAccountNumber: "XX1234",
            },
            duplicateCandidate: {
              detected: true,
              requiresDecision: true,
              reason: "Message contains duplicate marker text.",
              fingerprint: "125050|debit|2026-05-01|XX1234|BIGBAZAAR",
            },
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          validationState: "passed",
          acceptedForWrite: true,
          checkedFields: ["amountMinor", "direction", "transactionDate", "bankName", "accountNumber", "merchantOrPayee"],
          message: "Validation passed and the transaction was persisted deterministically.",
          persistedRecord: createPersistedRecord(),
        },
      });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("duplicate");

    const saveButton = await screen.findByRole("button", { name: /run save validation/i });
    await user.click(saveButton);

    expect((await screen.findAllByText(/possible duplicate detected/i)).length).toBeGreaterThan(0);
    expect(saveButton).toBeDisabled();

    await user.click(screen.getByLabelText(/continue as a new transaction candidate/i));
    expect(saveButton).toBeEnabled();
  });

  it("keeps save blocked until both mismatch and duplicate decisions are resolved", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "duplicate mismatch",
        normalizedText: "duplicate mismatch",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "ICICI Bank",
        accountNumber: "XX9999",
        merchantOrPayee: "BigBazaar",
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
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
              field: "accountNumber",
              reason: "ambiguous",
              hint: "Account mismatch detected. Choose a mismatch resolution before retrying save.",
            },
            {
              field: "merchantOrPayee",
              reason: "ambiguous",
              hint: "Possible duplicate detected. Choose a duplicate decision before retrying save.",
            },
          ],
          accountMismatch: {
            detected: true,
            requiresResolution: true,
            parsedBankName: "ICICI Bank",
            parsedAccountNumber: "XX9999",
            selectedBankName: "HDFC Bank",
            selectedAccountNumber: "XX1234",
          },
          duplicateCandidate: {
            detected: true,
            requiresDecision: true,
            reason: "Message contains duplicate marker text.",
            fingerprint: "125050|debit|2026-05-01|XX9999|BIGBAZAAR",
          },
        },
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("duplicate mismatch");

    const saveButton = await screen.findByRole("button", { name: /run save validation/i });
    await user.click(saveButton);

    expect((await screen.findAllByText(/account mismatch detected/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/possible duplicate detected/i)).length).toBeGreaterThan(0);
    expect(saveButton).toBeDisabled();

    await user.click(screen.getByLabelText(/keep selected account and continue validation/i));
    expect(saveButton).toBeDisabled();

    await user.click(screen.getByLabelText(/continue as a new transaction candidate/i));
    expect(saveButton).toBeEnabled();
  });

  it("sends user-selected category override in save payload", async () => {
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
        suggestedCategory: "groceries",
        finalCategory: "groceries",
        categorySource: "suggested",
        readinessState: "ready",
      },
    });

    const saveAttempt = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        validationState: "passed",
        acceptedForWrite: true,
        checkedFields: [
          "amountMinor",
          "direction",
          "transactionDate",
          "bankName",
          "accountNumber",
          "merchantOrPayee",
        ],
        message: "Validation passed and the transaction was persisted deterministically.",
        persistedRecord: createPersistedRecord(),
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.");

    await user.selectOptions(screen.getByLabelText(/category before save/i), "shopping");

    const saveButton = await screen.findByRole("button", { name: /run save validation/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(saveAttempt).toHaveBeenCalledTimes(1);
    });

    const payload = saveAttempt.mock.calls[0][0] as SaveTransactionAttemptPayload;
    expect(payload.parsedPayload.suggestedCategory).toBe("groceries");
    expect(payload.parsedPayload.finalCategory).toBe("shopping");
    expect(payload.parsedPayload.categorySource).toBe("user-override");
  });

  it("shows duplicate-flagged semantic state while duplicate decision is unresolved", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "duplicate semantic",
        normalizedText: "duplicate semantic",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "HDFC Bank",
        accountNumber: "XX1234",
        merchantOrPayee: "BigBazaar",
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
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
          blockedFields: [],
          accountMismatch: {
            detected: false,
            requiresResolution: false,
            selectedBankName: "HDFC Bank",
            selectedAccountNumber: "XX1234",
          },
          duplicateCandidate: {
            detected: true,
            requiresDecision: true,
            reason: "Potential duplicate",
            fingerprint: "125050|debit|2026-05-01|XX1234|BIGBAZAAR",
          },
        },
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("duplicate semantic");

    await user.click(await screen.findByRole("button", { name: /run save validation/i }));

    expect(await screen.findByText(/state: duplicate flagged/i)).toBeInTheDocument();
    expect(screen.getByText(/explicit duplicate decision required/i)).toBeInTheDocument();
  });

  it("shows blocked semantic state when mismatch resolution is required", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "mismatch semantic",
        normalizedText: "mismatch semantic",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "ICICI Bank",
        accountNumber: "XX9999",
        merchantOrPayee: "BigBazaar",
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "ready",
      },
    });

    const saveAttempt = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Critical fields are missing or ambiguous. Save is blocked.",
        hint: "Resolve mismatch before retrying save.",
        details: {
          blockedFields: [],
          accountMismatch: {
            detected: true,
            requiresResolution: true,
            parsedBankName: "ICICI Bank",
            parsedAccountNumber: "XX9999",
            selectedBankName: "HDFC Bank",
            selectedAccountNumber: "XX1234",
          },
          duplicateCandidate: {
            detected: false,
            requiresDecision: false,
          },
        },
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={saveAttempt} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("mismatch semantic");

    await user.click(await screen.findByRole("button", { name: /run save validation/i }));

    expect(await screen.findByText(/state: blocked by validation gates/i)).toBeInTheDocument();
    expect(screen.getByText(/resolve blocked fields or account mismatch decisions/i)).toBeInTheDocument();
  });

  it("keeps save availability stable when returning focus after keyboard correction flow", async () => {
    const user = userEvent.setup();
    const parseMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rawText: "keyboard flow",
        normalizedText: "keyboard flow",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: null,
        accountNumber: null,
        merchantOrPayee: null,
        suggestedCategory: "other",
        finalCategory: "other",
        categorySource: "suggested",
        readinessState: "needs-review",
      },
    });

    render(<CaptureHarness parseMessage={parseMessage} saveAttempt={vi.fn()} />);

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("keyboard flow");

    await user.click(await screen.findByRole("button", { name: /open guided corrections/i }));
    await user.click(screen.getByLabelText(/^bank$/i));
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText(/^bank$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open guided corrections/i }));
    await user.type(screen.getByLabelText(/^bank$/i), "HDFC Bank");
    await user.type(screen.getByLabelText(/^account$/i), "XX1234");
    await user.type(screen.getByLabelText(/^merchant\/payee$/i), "BigBazaar");
    await user.keyboard("{Enter}");

    const saveButton = screen.getByRole("button", { name: /run save validation/i });
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });

    await user.click(screen.getByLabelText(/bank message/i));
    expect(saveButton).toBeEnabled();
  });
});


