import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { isTauri } from "@tauri-apps/api/core";

import App from "../../App";
import { attemptTransactionSave, parseTransactionMessage } from "../capture/service";
import { AccountSetupScreen } from "./components/AccountSetupScreen";
import { createLedgerAccount, getLedgerBaseline, updateCaptureTransactionCategory } from "./service";

vi.mock("./service", () => ({
  createLedgerAccount: vi.fn(),
  getLedgerBaseline: vi.fn(),
  updateCaptureTransactionCategory: vi.fn(),
}));

vi.mock("../capture/service", () => ({
  parseTransactionMessage: vi.fn(),
  attemptTransactionSave: vi.fn(),
}));

const baselineDefaults = {
  trendAlert: {
    windowPreset: "30d",
    currentSpendMinor: 0,
    baselineSpendMinor: 0,
    deltaPercent: 0,
    thresholdPercent: 20,
    isAlert: false,
    reason: "Not enough persisted debit history to compare trend windows.",
  },
  runningBalance: {
    windowPreset: "30d",
    points: [],
  },
  insightSummary: [
    {
      kind: "category",
      title: "Category story",
      headline: "No category signal available",
      metricLabel: "Top category spend",
      metricValue: "INR 0.00",
      supportingText: "Debit category concentration appears here after saves are committed.",
      isEmpty: true,
      emptyState: {
        title: "No categorized transactions yet",
        detail: "There are no persisted debit transactions to summarize by category.",
        nextAction: "Save more categorized transactions to unlock this insight.",
      },
    },
    {
      kind: "merchant",
      title: "Merchant story",
      headline: "No merchant signal available",
      metricLabel: "Top merchant spend",
      metricValue: "INR 0.00",
      supportingText: "Merchant concentration appears here after persisted debit activity.",
      isEmpty: true,
      emptyState: {
        title: "No merchant activity yet",
        detail: "There are no eligible merchant rows in persisted debit history.",
        nextAction: "Save additional transactions to build merchant insights.",
      },
    },
    {
      kind: "trend",
      title: "Trend story",
      headline: "No trend signal available",
      metricLabel: "Window delta",
      metricValue: "0.0%",
      supportingText: "Trend movement appears after two comparable debit windows are available.",
      badgeLabel: "Stable",
      isEmpty: true,
      emptyState: {
        title: "Not enough history for a trend",
        detail: "A deterministic trend requires persisted debit data across baseline and current windows.",
        nextAction: "Save more categorized transactions in this preset window.",
      },
    },
  ],
};

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
        ...baselineDefaults,
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
        ...baselineDefaults,
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
        ...baselineDefaults,
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
        insightSummary: [
          {
            kind: "category",
            title: "Category story",
            headline: "Groceries",
            metricLabel: "Top category spend",
            metricValue: "INR 82.00",
            supportingText: "3 transactions account for 62.1% of persisted debit spend.",
            badgeLabel: "62.1% share",
            isEmpty: false,
            emptyState: baselineDefaults.insightSummary[0].emptyState,
          },
          {
            kind: "merchant",
            title: "Merchant story",
            headline: "BigBazaar",
            metricLabel: "Top merchant spend",
            metricValue: "INR 82.00",
            supportingText: "3 transactions. Last seen on 2026-05-03.",
            isEmpty: false,
            emptyState: baselineDefaults.insightSummary[1].emptyState,
          },
          {
            kind: "trend",
            title: "Trend story",
            headline: "Not enough persisted debit history to compare trend windows.",
            metricLabel: "Window delta",
            metricValue: "0.0%",
            supportingText: "Current INR 0.00 vs baseline INR 0.00 for preset 30d.",
            badgeLabel: "Stable",
            isEmpty: true,
            emptyState: baselineDefaults.insightSummary[2].emptyState,
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByText(/category story/i)).toBeInTheDocument();
    expect(screen.getByText(/merchant story/i)).toBeInTheDocument();
    expect(screen.getByText(/groceries/i)).toBeInTheDocument();
    expect(screen.getByText(/bigbazaar/i)).toBeInTheDocument();
  });

  it("renders trend alert metadata and running-balance points from baseline payload", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        ...baselineDefaults,
        account: {
          id: 1,
          bankName: "HDFC",
          accountNumber: "1234",
          currentBalanceMinor: 125050,
        },
        entries: [],
        categoryInsights: [],
        merchantInsights: [],
        trendAlert: {
          windowPreset: "30d",
          currentSpendMinor: 9000,
          baselineSpendMinor: 6000,
          deltaPercent: 50,
          thresholdPercent: 20,
          isAlert: true,
          reason: "Current window spend is 50.0% above baseline.",
        },
        runningBalance: {
          windowPreset: "30d",
          points: [
            {
              timestamp: "2026-05-01 10:00:00",
              balanceMinor: 10000,
              deltaMinor: 10000,
              entryId: 1,
              entryKind: "opening_balance",
            },
            {
              timestamp: "2026-05-02 10:00:00",
              balanceMinor: 9000,
              deltaMinor: -1000,
              entryId: 2,
              entryKind: "capture_transaction",
            },
          ],
        },
        insightSummary: [
          baselineDefaults.insightSummary[0],
          baselineDefaults.insightSummary[1],
          {
            kind: "trend",
            title: "Trend story",
            headline: "Current window spend is 50.0% above baseline.",
            metricLabel: "Window delta",
            metricValue: "50.0%",
            supportingText: "Current INR 90.00 vs baseline INR 60.00 for preset 30d.",
            badgeLabel: "Alert",
            isEmpty: false,
            emptyState: baselineDefaults.insightSummary[2].emptyState,
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /trend story/i })).toBeInTheDocument();
    expect(screen.getByText(/current window spend is 50.0% above baseline/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /running balance/i })).toBeInTheDocument();
    expect(screen.getByText(/opening balance/i)).toBeInTheDocument();
  });

  it("shows deterministic empty states for trend and running-balance regions", async () => {
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
        trendAlert: {
          windowPreset: "30d",
          currentSpendMinor: 0,
          baselineSpendMinor: 0,
          deltaPercent: 0,
          thresholdPercent: 20,
          isAlert: false,
          reason: "Not enough persisted debit history to compare trend windows.",
        },
        runningBalance: {
          windowPreset: "30d",
          points: [],
        },
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByText(/not enough history for a trend/i)).toBeInTheDocument();
    expect(screen.getByText(/no running-balance points available for this preset window yet/i)).toBeInTheDocument();
  });

  it("shows deterministic empty states when no persisted insight rows are available", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        ...baselineDefaults,
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

    expect(await screen.findByText(/no categorized transactions yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no merchant activity yet/i)).toBeInTheDocument();
  });

  it("renders exactly three summary story cards in deterministic order", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        ...baselineDefaults,
        account: {
          id: 1,
          bankName: "HDFC",
          accountNumber: "1234",
          currentBalanceMinor: 125050,
        },
        entries: [],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    const cards = await screen.findAllByRole("article");
    expect(cards.slice(0, 3).map((card) => card.getAttribute("aria-label"))).toEqual([
      "Category story",
      "Merchant story",
      "Trend story",
    ]);
    expect(screen.getByText(/save more categorized transactions to unlock this insight/i)).toBeInTheDocument();
  });

  it("fills missing insight kinds with deterministic fallback cards", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        ...baselineDefaults,
        account: {
          id: 1,
          bankName: "HDFC",
          accountNumber: "1234",
          currentBalanceMinor: 125050,
        },
        entries: [],
        insightSummary: [
          {
            kind: "category",
            title: "Category story",
            headline: "Groceries",
            metricLabel: "Top category spend",
            metricValue: "INR 82.00",
            supportingText: "3 transactions account for 62.1% of persisted debit spend.",
            badgeLabel: "62.1% share",
            isEmpty: false,
            emptyState: baselineDefaults.insightSummary[0].emptyState,
          },
        ],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    const cards = await screen.findAllByRole("article");
    expect(cards.slice(0, 3).map((card) => card.getAttribute("aria-label"))).toEqual([
      "Category story",
      "Merchant story",
      "Trend story",
    ]);
    expect(screen.getByText(/no merchant activity yet/i)).toBeInTheDocument();
    expect(screen.getByText(/not enough history for a trend/i)).toBeInTheDocument();
  });

  it("keeps summary cards rendered after narrow viewport resize", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        ...baselineDefaults,
        account: {
          id: 1,
          bankName: "HDFC",
          accountNumber: "1234",
          currentBalanceMinor: 125050,
        },
        entries: [],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    Object.defineProperty(window, "innerWidth", {
      value: 760,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));

    const cards = await screen.findAllByRole("article");
    expect(cards.slice(0, 3).map((card) => card.getAttribute("aria-label"))).toEqual([
      "Category story",
      "Merchant story",
      "Trend story",
    ]);
  });

  it("does not show account setup before the first save-triggered new-account flow", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        ...baselineDefaults,
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
        ...baselineDefaults,
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
        ...baselineDefaults,
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

  it("opens prefilled account setup when parsed account is chosen but not yet in the ledger", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline).mockReset();
    vi.mocked(parseTransactionMessage).mockReset();
    vi.mocked(attemptTransactionSave).mockReset();
    vi.mocked(createLedgerAccount).mockReset();

    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        ...baselineDefaults,
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
        rawText: "Sent Rs.100.00 From HDFC Bank A/C *1234 To Axis Bank On 2026-05-13",
        normalizedText: "Sent Rs.100.00 From HDFC Bank A/C *1234 To Axis Bank On 2026-05-13",
        amountMinor: 10000,
        direction: "debit",
        transactionDate: "2026-05-13",
        bankName: "HDFC Bank",
        accountNumber: "*1234",
        merchantOrPayee: "Axis",
        suggestedCategory: "transfer",
        finalCategory: "transfer",
        categorySource: "suggested",
        readinessState: "ready",
      },
    });

    vi.mocked(attemptTransactionSave)
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "The parsed account was not found in local ledger accounts. Create or select that account before saving.",
          hint: "Create or select the parsed account in the local ledger, then retry save.",
          details: {
            blockedFields: [
              {
                field: "accountNumber",
                reason: "ambiguous",
                hint: "Parsed account is not yet available in the local ledger.",
              },
            ],
            nextAction: "Create/select the parsed account and retry save.",
          },
        },
      })
      .mockResolvedValueOnce({
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

    vi.mocked(createLedgerAccount).mockResolvedValue({
      ok: true,
      data: {
        accountId: 2,
        bankName: "HDFC Bank",
        accountNumber: "*1234",
        openingBalanceMinor: 0,
        openingEntryId: 10,
      },
    });

    render(<App />);

    await user.click(await screen.findByLabelText(/bank message/i));
    await user.paste("Sent Rs.100.00 From HDFC Bank A/C *1234 To Axis Bank On 2026-05-13");
    await user.click(await screen.findByLabelText(/treat parsed account as intended and continue validation/i));
    await user.click(screen.getByRole("button", { name: /run save validation/i }));

    expect(await screen.findByRole("heading", { name: /account confirmation/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/bank name/i)).toHaveValue("HDFC Bank");
    expect(screen.getByLabelText(/account number/i)).toHaveValue("*1234");

    await user.type(screen.getByLabelText(/opening balance/i), "0.00");
    await user.click(screen.getByRole("button", { name: /create account and opening balance/i }));

    await waitFor(() => {
      expect(createLedgerAccount).toHaveBeenCalledWith({
        bankName: "HDFC Bank",
        accountNumber: "*1234",
        openingBalanceMinor: 0,
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /account confirmation/i })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /run save validation/i }));

    await waitFor(() => {
      expect(attemptTransactionSave).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/save persisted: passed/i)).toBeInTheDocument();
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
          ...baselineDefaults,
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
          insightSummary: [
            {
              kind: "category",
              title: "Category story",
              headline: "Groceries",
              metricLabel: "Top category spend",
              metricValue: "INR 12.00",
              supportingText: "1 transactions account for 100.0% of persisted debit spend.",
              badgeLabel: "100.0% share",
              isEmpty: false,
              emptyState: baselineDefaults.insightSummary[0].emptyState,
            },
            {
              kind: "merchant",
              title: "Merchant story",
              headline: "OldMerchant",
              metricLabel: "Top merchant spend",
              metricValue: "INR 12.00",
              supportingText: "1 transactions. Last seen on 2026-05-01.",
              isEmpty: false,
              emptyState: baselineDefaults.insightSummary[1].emptyState,
            },
            baselineDefaults.insightSummary[2],
          ],
          ordering: "created_at_desc_id_desc",
        },
      })
      .mockResolvedValue({
        ok: true,
        data: {
          ...baselineDefaults,
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
          insightSummary: [
            {
              kind: "category",
              title: "Category story",
              headline: "Shopping",
              metricLabel: "Top category spend",
              metricValue: "INR 12.50",
              supportingText: "1 transactions account for 100.0% of persisted debit spend.",
              badgeLabel: "100.0% share",
              isEmpty: false,
              emptyState: baselineDefaults.insightSummary[0].emptyState,
            },
            {
              kind: "merchant",
              title: "Merchant story",
              headline: "CityMall",
              metricLabel: "Top merchant spend",
              metricValue: "INR 12.50",
              supportingText: "1 transactions. Last seen on 2026-05-02.",
              isEmpty: false,
              emptyState: baselineDefaults.insightSummary[1].emptyState,
            },
            baselineDefaults.insightSummary[2],
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
    const merchantCard = await screen.findByRole("article", { name: /merchant story/i });
    expect(within(merchantCard).getByText(/citymall/i)).toBeInTheDocument();
    expect(screen.queryByText(/oldmerchant/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: /capture confirmation/i })).toHaveTextContent(/transaction saved successfully/i);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports post-save category override from ledger history", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        ...baselineDefaults,
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
        ...baselineDefaults,
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
        ...baselineDefaults,
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
        ...baselineDefaults,
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
        ...baselineDefaults,
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