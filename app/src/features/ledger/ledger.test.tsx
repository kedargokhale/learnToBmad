import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AccountSetupScreen } from "./components/AccountSetupScreen";

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