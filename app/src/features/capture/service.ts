import { invoke } from "@tauri-apps/api/core";

import type { CommandEnvelope, CommandError } from "../ledger/service";
import type { BlockedFieldReason } from "./schema";

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
  readinessState: "ready" | "needs-review";
};

export type ParsePreviewEnvelope = CommandEnvelope<ParsePreviewData>;

export async function parseTransactionMessage(
  payload: ParseTransactionPayload,
): Promise<ParsePreviewEnvelope> {
  return invoke<ParsePreviewEnvelope>("parse_transaction_message", {
    payload,
  });
}

export type SaveAccountContext = {
  accountId: number;
  bankName: string;
  accountNumber: string;
};

export type SaveTransactionAttemptPayload = {
  accountContext: SaveAccountContext;
  parsedPayload: ParsePreviewData;
};

export type SaveTransactionAttemptData = {
  validationState: "passed";
  acceptedForWrite: boolean;
  checkedFields: ReadonlyArray<BlockedFieldReason["field"]>;
  message: string;
};

export type SaveTransactionAttemptEnvelope = CommandEnvelope<SaveTransactionAttemptData>;

export async function attemptTransactionSave(
  payload: SaveTransactionAttemptPayload,
): Promise<SaveTransactionAttemptEnvelope> {
  return invoke<SaveTransactionAttemptEnvelope>("attempt_transaction_save", {
    payload,
  });
}

export type { CommandError };
