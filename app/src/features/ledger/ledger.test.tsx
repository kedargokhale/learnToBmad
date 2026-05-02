import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import App from "../../App";
import { AccountSetupScreen } from "./components/AccountSetupScreen";
import { createLedgerAccount, getLedgerBaseline } from "./service";

vi.mock("./service", () => ({
  createLedgerAccount: vi.fn(),
  getLedgerBaseline: vi.fn(),
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
  it("falls back to setup flow when baseline fetch rejects", async () => {
    vi.mocked(getLedgerBaseline).mockRejectedValueOnce(new Error("ipc failure"));

    render(<App />);

    expect(await screen.findByRole("heading", { name: /account setup/i })).toBeInTheDocument();
  });

  it("shows setup flow when no existing account baseline is present", async () => {
    vi.mocked(getLedgerBaseline).mockResolvedValue({
      ok: true,
      data: {
        account: null,
        entries: [],
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /account setup/i })).toBeInTheDocument();
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
        ordering: "created_at_desc_id_desc",
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /transaction history/i })).toBeInTheDocument();
    expect(screen.getByText(/hdfc/i)).toBeInTheDocument();
  });

  it("hands off from successful setup to baseline view", async () => {
    const user = userEvent.setup();

    vi.mocked(getLedgerBaseline)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          account: null,
          entries: [],
          ordering: "created_at_desc_id_desc",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          account: {
            id: 3,
            bankName: "Axis",
            accountNumber: "3333",
            currentBalanceMinor: 5000,
          },
          entries: [
            {
              id: 8,
              entryKind: "opening_balance",
              amountMinor: 5000,
              createdAt: "2026-05-02 10:10:00",
            },
          ],
          ordering: "created_at_desc_id_desc",
        },
      });

    vi.mocked(createLedgerAccount).mockResolvedValue({
      ok: true,
      data: {
        accountId: 3,
        bankName: "Axis",
        accountNumber: "3333",
        openingBalanceMinor: 5000,
        openingEntryId: 8,
      },
    });

    render(<App />);

    await user.type(await screen.findByLabelText(/bank name/i), "Axis");
    await user.type(screen.getByLabelText(/account number/i), "3333");
    await user.type(screen.getByLabelText(/opening balance/i), "50.00");
    await user.click(screen.getByRole("button", { name: /create account and opening balance/i }));

    expect(await screen.findByRole("heading", { name: /transaction history/i })).toBeInTheDocument();
  });
});