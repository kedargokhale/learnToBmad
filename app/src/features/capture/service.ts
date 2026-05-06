import { invoke } from "@tauri-apps/api/core";

import type { CommandEnvelope, CommandError } from "../ledger/service";

export type ParseTransactionPayload = {
  message: string;
};

export type ParsePreviewData = {
  rawText: string;
  normalizedText: string;
  amountMinor: number | null;
  direction: "debit" | "credit" | null;
  transactionDate: string | null;
  bankName: string | null;
  accountNumber: string | null;
  merchantOrPayee: string | null;
  readinessState: "ready" | "needs-review" | "parse-failed";
};

export type ParsePreviewEnvelope = CommandEnvelope<ParsePreviewData>;

export async function parseTransactionMessage(
  payload: ParseTransactionPayload,
): Promise<ParsePreviewEnvelope> {
  return invoke<ParsePreviewEnvelope>("parse_transaction_message", {
    payload,
  });
}

export type { CommandError };
