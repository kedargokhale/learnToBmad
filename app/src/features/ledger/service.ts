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
  captureTransactionId?: number;
  finalCategory?: string;
  categorySource?: "suggested" | "user-override";
};

export type LedgerAccountData = {
  id: number;
  bankName: string;
  accountNumber: string;
  currentBalanceMinor: number;
};

export type LedgerScopeSelection =
  | {
      kind: "all-accounts";
    }
  | {
      kind: "account";
      accountId: number;
    };

export type LedgerScopeSummaryData = {
  kind: "all-accounts" | "account";
  label: string;
  accountId?: number;
  accountCount: number;
  currentBalanceMinor: number;
};

export type LedgerCategoryInsightData = {
  categoryName: string;
  totalAmountMinor: number;
  sharePercent: number;
  transactionCount: number;
};

export type LedgerMerchantInsightData = {
  merchantOrPayee: string;
  totalAmountMinor: number;
  transactionCount: number;
  lastSeenDate?: string;
};

export type LedgerTrendAlertData = {
  windowPreset: string;
  currentSpendMinor: number;
  baselineSpendMinor: number;
  deltaPercent: number;
  thresholdPercent: number;
  isAlert: boolean;
  reason: string;
};

export type RunningBalancePointData = {
  timestamp: string;
  balanceMinor: number;
  deltaMinor: number;
  entryId: number;
  entryKind: string;
};

export type LedgerRunningBalanceData = {
  windowPreset: string;
  points: RunningBalancePointData[];
};

export type LedgerInsightCardKind = string;

export type LedgerInsightCardEmptyStateData = {
  title: string;
  detail: string;
  nextAction: string;
};

export type LedgerInsightSummaryCardData = {
  kind: LedgerInsightCardKind;
  title: string;
  headline: string;
  metricLabel: string;
  metricValue: string;
  supportingText: string;
  badgeLabel?: string;
  isEmpty: boolean;
  emptyState: LedgerInsightCardEmptyStateData;
};

export type LedgerBaselineData = {
  scope?: LedgerScopeSummaryData;
  account: LedgerAccountData | null;
  accounts?: LedgerAccountData[];
  entries: LedgerEntryData[];
  categoryInsights?: LedgerCategoryInsightData[];
  merchantInsights?: LedgerMerchantInsightData[];
  trendAlert: LedgerTrendAlertData;
  runningBalance: LedgerRunningBalanceData;
  insightSummary?: LedgerInsightSummaryCardData[];
  ordering: string;
};

export type LedgerBaselineRequest = {
  scope?: LedgerScopeSelection;
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

export async function getLedgerBaseline(
  payload?: LedgerBaselineRequest,
): Promise<CommandEnvelope<LedgerBaselineData>> {
  return invoke<CommandEnvelope<LedgerBaselineData>>("get_ledger_baseline", payload ? { payload } : undefined);
}

export async function updateCaptureTransactionCategory(payload: {
  transactionId: number;
  finalCategory: string;
}): Promise<CommandEnvelope<{
  transactionId: number;
  finalCategory: string;
  categorySource: "suggested" | "user-override";
  auditEntryId: number;
}>> {
  return invoke("update_capture_transaction_category", {
    payload,
  });
}