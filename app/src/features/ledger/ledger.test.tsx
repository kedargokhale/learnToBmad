import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { isTauri } from "@tauri-apps/api/core";

import App from "../../App";
import { attemptTransactionSave, parseTransactionMessage } from "../capture/service";
import { AccountSetupScreen } from "./components/AccountSetupScreen";
import { getLedgerBaseline, updateCaptureTransactionCategory } from "./service";

vi.mock("./service", () => ({
  createLedgerAccount: vi.fn(),
  getLedgerBaseline: vi.fn(),
  updateCaptureTransactionCategory: vi.fn(),
}));

vi.mock("../capture/service", () => ({
  parseTransactionMessage: vi.fn(),
  attemptTransactionSave: vi.fn(),
}));

describe("AccountSetupScreen", () => {
  it("submits a valid account setup request", async () => {
    const user = userEvent.setup();
    const submitAccount = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        accountId: 3,
        bankName: "HDFC",
        accountNumber: "1234",
        openingBalanceMinor: 125050,
        openingEntryId: 9,
      },
    });

    render(<AccountSetupScreen submitAccount={submitAccount} />);

    expect(screen.getByRole("heading", { name: /account confirmation/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/bank name/i), "HDFC");
    await user.type(screen.getByLabelText(/account number/i), "1234");
    await user.type(screen.getByLabelText(/opening balance/i), "1250.50");
    await user.click(screen.getByRole("button", { name: /create account and opening balance/i }));

    await waitFor(() => {
      expect(submitAccount).toHaveBeenCalledWith({
        bankName: "HDFC",
        accountNumber: "1234",
        openingBalanceMinor: 125050,
      });
    });

    expect(screen.getByRole("status")).toHaveTextContent(/ledger created locally/i);
  });

  it("blocks invalid opening balance input before submit", async () => {
    const user = userEvent.setup();
    const submitAccount = vi.fn();

    render(<AccountSetupScreen submitAccount={submitAccount} />);

    await user.type(screen.getByLabelText(/bank name/i), "ICICI");
    await user.type(screen.getByLabelText(/account number/i), "9999");
    await user.type(screen.getByLabelText(/opening balance/i), "10.123");
    await user.click(screen.getByRole("button", { name: /create account and opening balance/i }));

    expect(await screen.findByText(/opening balance must be a valid amount/i)).toBeInTheDocument();
    expect(submitAccount).not.toHaveBeenCalled();
  });

  it("shows duplicate account errors from the native command envelope", async () => {
    const user = userEvent.setup();
    const submitAccount = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "ACCOUNT_ALREADY_EXISTS",
        message: "An account already exists for that bank and account number.",
        hint: "Review the account details or use the existing ledger account.",
      },
    });

    render(<AccountSetupScreen submitAccount={submitAccount} />);

    await user.type(screen.getByLabelText(/bank name/i), "ICICI");
    await user.type(screen.getByLabelText(/account number/i), "9999");
    await user.type(screen.getByLabelText(/opening balance/i), "50.00");
    await user.click(screen.getByRole("button", { name: /create account and opening balance/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/account already exists/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/review the account details/i);
  });

  it("rejects whitespace-only bank name input", async () => {
    const user = userEvent.setup();
    const submitAccount = vi.fn();

    render(<AccountSetupScreen submitAccount={submitAccount} />);

    await user.type(screen.getByLabelText(/bank name/i), "   ");
    await user.type(screen.getByLabelText(/account number/i), "1234");
    await user.type(screen.getByLabelText(/opening balance/i), "100.00");
    await user.click(screen.getByRole("button", { name: /create account and opening balance/i }));

    expect(screen.getByText(/bank name is required/i)).toBeInTheDocument();
    expect(submitAccount).not.toHaveBeenCalled();
  });
});

describe("Ledger baseline app flow", () => {
  it("falls back to dashboard capture shell when baseline fetch rejects", async () => {
    vi.mocked(getLedgerBaseline).mockRejectedValueOnce(new Error("ipc failure"));

    render(<App />);

    expect(await screen.findByRole("heading", { name: /paste-to-parse capture/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /account setup/i })).not.toBeInTheDocument();
  });

  it("shows dashboard capture shell when no existing account baseline is present", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: null,
        entries: [],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /paste-to-parse capture/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /account setup/i })).not.toBeInTheDocument();
  });

  it("shows baseline ledger view for an existing account", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: {
          id: 1,
          bankName: "HDFC",
          accountNumber: "1234",
          currentBalanceMinor: 125050,
        },
        entries: [
          {
            id: 9,
            entryKind: "opening_balance",
            amountMinor: 125050,
            createdAt: "2026-05-02 10:00:00",
          },
        ],
        categoryInsights: [
          {
            categoryName: "groceries",
            totalAmountMinor: 125050,
            sharePercent: 100,
            transactionCount: 1,
          },
        ],
        merchantInsights: [
          {
            merchantOrPayee: "BigBazaar",
            totalAmountMinor: 125050,
            transactionCount: 1,
            lastSeenDate: "2026-05-01",
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /transaction history/i })).toBeInTheDocument();
    expect(screen.getByText(/hdfc/i)).toBeInTheDocument();
  });

  it("renders category and merchant insight cards from persisted baseline data", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: {
          id: 1,
          bankName: "HDFC",
          accountNumber: "1234",
          currentBalanceMinor: 125050,
        },
        entries: [
          {
            id: 9,
            entryKind: "opening_balance",
            amountMinor: 125050,
            createdAt: "2026-05-02 10:00:00",
          },
        ],
        categoryInsights: [
          {
            categoryName: "groceries",
            totalAmountMinor: 8200,
            sharePercent: 62.1,
            transactionCount: 3,
          },
        ],
        merchantInsights: [
          {
            merchantOrPayee: "BigBazaar",
            totalAmountMinor: 8200,
            transactionCount: 3,
            lastSeenDate: "2026-05-03",
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByText(/category dominance/i)).toBeInTheDocument();
    expect(screen.getByText(/merchant focus/i)).toBeInTheDocument();
    expect(screen.getByText(/groceries/i)).toBeInTheDocument();
    expect(screen.getByText(/bigbazaar/i)).toBeInTheDocument();
  });

  it("shows deterministic empty states when no persisted insight rows are available", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: {
          id: 1,
          bankName: "HDFC",
          accountNumber: "1234",
          currentBalanceMinor: 125050,
        },
        entries: [],
        categoryInsights: [],
        merchantInsights: [],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByText(/no persisted debit transactions in this period yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no merchant activity available for this period yet/i)).toBeInTheDocument();
  });

  it("does not show account setup before the first save-triggered new-account flow", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: null,
        entries: [],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /paste-to-parse capture/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /account setup/i })).not.toBeInTheDocument();
  });

  it("shows account setup only after first save attempt when no account baseline exists", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: null,
        entries: [],
        ordering: "created_at_desc_id_desc",
      },
    });

    vi.mocked(parseTransactionMessage).mockResolvedValue({
      ok: true,
      data: {
        rawText: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
        normalizedText:
          "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
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

    render(<App />);

    expect(await screen.findByRole("heading", { name: /paste-to-parse capture/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /account confirmation/i })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.");
    await user.click(await screen.findByRole("button", { name: /run save validation/i }));

    expect(await screen.findByRole("heading", { name: /account confirmation/i })).toBeInTheDocument();
    expect(screen.queryByText(/first-run ledger setup/i)).not.toBeInTheDocument();
    expect(attemptTransactionSave).not.toHaveBeenCalled();
  });

  it("keeps account setup hidden on save attempt when an account baseline exists", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: {
          id: 1,
          bankName: "HDFC Bank",
          accountNumber: "XX1234",
          currentBalanceMinor: 125050,
        },
        entries: [
          {
            id: 9,
            entryKind: "opening_balance",
            amountMinor: 125050,
            createdAt: "2026-05-02 10:00:00",
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    vi.mocked(parseTransactionMessage).mockResolvedValue({
      ok: true,
      data: {
        rawText: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
        normalizedText:
          "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
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

    vi.mocked(attemptTransactionSave).mockResolvedValue({
      ok: true,
      data: {
        validationState: "passed",
        acceptedForWrite: false,
        checkedFields: [
          "amountMinor",
          "direction",
          "transactionDate",
          "bankName",
          "accountNumber",
          "merchantOrPayee",
        ],
        message: "Validation passed.",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /paste-to-parse capture/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /account confirmation/i })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.");
    await user.click(await screen.findByRole("button", { name: /run save validation/i }));

    await waitFor(() => {
      expect(attemptTransactionSave).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("heading", { name: /account confirmation/i })).not.toBeInTheDocument();
  });

  it("refreshes insight cards after committed save baseline refresh", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline).mockReset();
    vi.mocked(parseTransactionMessage).mockReset();
    vi.mocked(attemptTransactionSave).mockReset();

    vi.mocked(getLedgerBaseline)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          account: {
            id: 1,
            bankName: "HDFC Bank",
            accountNumber: "XX1234",
            currentBalanceMinor: 125050,
          },
          entries: [],
          categoryInsights: [
            {
              categoryName: "groceries",
              totalAmountMinor: 1200,
              sharePercent: 100,
              transactionCount: 1,
            },
          ],
          merchantInsights: [
            {
              merchantOrPayee: "OldMerchant",
              totalAmountMinor: 1200,
              transactionCount: 1,
              lastSeenDate: "2026-05-01",
            },
          ],
          ordering: "created_at_desc_id_desc",
        },
      })
      .mockResolvedValue({
        ok: true,
        data: {
          account: {
            id: 1,
            bankName: "HDFC Bank",
            accountNumber: "XX1234",
            currentBalanceMinor: 123800,
          },
          entries: [
            {
              id: 100,
              entryKind: "capture_transaction",
              amountMinor: -1250,
              createdAt: "2026-05-02 10:00:00",
              captureTransactionId: 11,
              finalCategory: "shopping",
              categorySource: "suggested",
            },
          ],
          categoryInsights: [
            {
              categoryName: "shopping",
              totalAmountMinor: 1250,
              sharePercent: 100,
              transactionCount: 1,
            },
          ],
          merchantInsights: [
            {
              merchantOrPayee: "CityMall",
              totalAmountMinor: 1250,
              transactionCount: 1,
              lastSeenDate: "2026-05-02",
            },
          ],
          ordering: "created_at_desc_id_desc",
        },
      });

    vi.mocked(parseTransactionMessage).mockResolvedValue({
      ok: true,
      data: {
        rawText: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at CityMall.",
        normalizedText:
          "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at CityMall.",
        amountMinor: 125050,
        direction: "debit",
        transactionDate: "2026-05-01",
        bankName: "HDFC Bank",
        accountNumber: "XX1234",
        merchantOrPayee: "CityMall",
        suggestedCategory: "shopping",
        finalCategory: "shopping",
        categorySource: "suggested",
        readinessState: "ready",
      },
    });

    vi.mocked(attemptTransactionSave).mockResolvedValue({
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
        message: "Save committed successfully.",
      },
    });

    render(<App />);

    expect(await screen.findByText(/oldmerchant/i)).toBeInTheDocument();

    await user.click(screen.getByLabelText(/bank message/i));
    await user.paste("HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at CityMall.");
    await user.click(await screen.findByRole("button", { name: /run save validation/i }));

    await waitFor(() => {
      expect(getLedgerBaseline).toHaveBeenCalled();
    });
    const merchantCard = await screen.findByRole("article", { name: /merchant focus/i });
    expect(within(merchantCard).getByText(/citymall/i)).toBeInTheDocument();
    expect(screen.queryByText(/oldmerchant/i)).not.toBeInTheDocument();
  });

  it("supports post-save category override from ledger history", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: {
          id: 1,
          bankName: "HDFC Bank",
          accountNumber: "XX1234",
          currentBalanceMinor: 10000,
        },
        entries: [
          {
            id: 101,
            entryKind: "capture_transaction",
            amountMinor: -5000,
            createdAt: "2026-05-02 10:00:00",
            captureTransactionId: 1,
            finalCategory: "groceries",
            categorySource: "suggested",
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    vi.mocked(updateCaptureTransactionCategory).mockResolvedValue({
      ok: true,
      data: {
        transactionId: 1,
        finalCategory: "shopping",
        categorySource: "user-override",
        auditEntryId: 999,
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /transaction history/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/category for transaction 1/i), "shopping");
    await user.click(screen.getByRole("button", { name: /update category/i }));

    await waitFor(() => {
      expect(updateCaptureTransactionCategory).toHaveBeenCalledWith({
        transactionId: 1,
        finalCategory: "shopping",
      });
    });
  });

  it("shows backend validation errors for invalid category update", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: {
          id: 1,
          bankName: "HDFC Bank",
          accountNumber: "XX1234",
          currentBalanceMinor: 10000,
        },
        entries: [
          {
            id: 101,
            entryKind: "capture_transaction",
            amountMinor: -5000,
            createdAt: "2026-05-02 10:00:00",
            captureTransactionId: 1,
            finalCategory: "groceries",
            categorySource: "suggested",
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    vi.mocked(updateCaptureTransactionCategory).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Choose a valid category from the predefined taxonomy.",
        hint: "Correct the highlighted field and try again.",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /transaction history/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /update category/i }));

    await waitFor(() => {
      expect(updateCaptureTransactionCategory).toHaveBeenCalledWith({
        transactionId: 1,
        finalCategory: "groceries",
      });
    });
  });

  it("shows backend validation errors for missing transaction category update", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: {
          id: 1,
          bankName: "HDFC Bank",
          accountNumber: "XX1234",
          currentBalanceMinor: 10000,
        },
        entries: [
          {
            id: 101,
            entryKind: "capture_transaction",
            amountMinor: -5000,
            createdAt: "2026-05-02 10:00:00",
            captureTransactionId: 1,
            finalCategory: "groceries",
            categorySource: "suggested",
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    vi.mocked(updateCaptureTransactionCategory).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Capture transaction not found for category update.",
        hint: "Correct the highlighted field and try again.",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /transaction history/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /update category/i }));

    await waitFor(() => {
      expect(updateCaptureTransactionCategory).toHaveBeenCalledWith({
        transactionId: 1,
        finalCategory: "groceries",
      });
    });
  });

  it("shows backend validation errors for non-persisted transaction category update", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: {
          id: 1,
          bankName: "HDFC Bank",
          accountNumber: "XX1234",
          currentBalanceMinor: 10000,
        },
        entries: [
          {
            id: 101,
            entryKind: "capture_transaction",
            amountMinor: -5000,
            createdAt: "2026-05-02 10:00:00",
            captureTransactionId: 1,
            finalCategory: "groceries",
            categorySource: "suggested",
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    vi.mocked(updateCaptureTransactionCategory).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Category can only be updated for persisted transactions.",
        hint: "Correct the highlighted field and try again.",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /transaction history/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /update category/i }));

    await waitFor(() => {
      expect(updateCaptureTransactionCategory).toHaveBeenCalledWith({
        transactionId: 1,
        finalCategory: "groceries",
      });
    });
  });
});

describe("Desktop runtime guard", () => {
  it("renders unsupported runtime screen when not running in Tauri", async () => {
    vi.mocked(getLedgerBaseline).mockClear();
    vi.mocked(isTauri).mockReturnValueOnce(false);

    render(<App />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/desktop app required/i);
    expect(getLedgerBaseline).not.toHaveBeenCalled();
  });

  it("proceeds with normal baseline load when running in Tauri", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: null,
        entries: [],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /paste-to-parse capture/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /account confirmation/i })).not.toBeInTheDocument();
  });
});