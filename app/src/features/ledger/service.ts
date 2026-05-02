import { invoke } from "@tauri-apps/api/core";

export type CreateAccountPayload = {
  bankName: string;
  accountNumber: string;
  openingBalanceMinor: number;
};

export type CreateAccountData = {
  accountId: number;
  bankName: string;
  accountNumber: string;
  openingBalanceMinor: number;
  openingEntryId: number;
};

export type LedgerEntryData = {
  id: number;
  entryKind: string;
  amountMinor: number;
  createdAt: string;
};

export type LedgerAccountData = {
  id: number;
  bankName: string;
  accountNumber: string;
  currentBalanceMinor: number;
};

export type LedgerBaselineData = {
  account: LedgerAccountData | null;
  entries: LedgerEntryData[];
  ordering: string;
};

export type CommandError = {
  code: string;
  message: string;
  hint?: string;
  details?: Record<string, unknown>;
};

export type CommandEnvelope<T> =
  | {
      ok: true;
      data: T;
      error?: undefined;
    }
  | {
      ok: false;
      data?: undefined;
      error: CommandError;
    };

export async function createLedgerAccount(
  payload: CreateAccountPayload,
): Promise<CommandEnvelope<CreateAccountData>> {
  return invoke<CommandEnvelope<CreateAccountData>>("create_account", {
    payload,
  });
}

export async function getLedgerBaseline(): Promise<CommandEnvelope<LedgerBaselineData>> {
  return invoke<CommandEnvelope<LedgerBaselineData>>("get_ledger_baseline");
}