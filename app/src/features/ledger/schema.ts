import { z } from "zod";

const currencyPattern = /^\d+(?:\.\d{1,2})?$/;

export const accountSetupSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required."),
  accountNumber: z
    .string()
    .trim()
    .min(1, "Account number is required.")
    .regex(/^[A-Za-z0-9*\-\/ ]+$/, "Account number can only include letters, numbers, spaces, asterisks, hyphens, and slashes."),
  openingBalance: z
    .string()
    .trim()
    .min(1, "Opening balance is required.")
    .regex(currencyPattern, "Opening balance must be a valid amount with up to 2 decimal places."),
});

export type AccountSetupFormValues = z.infer<typeof accountSetupSchema>;

export const ledgerEntrySchema = z.object({
  id: z.number().int().nonnegative(),
  entryKind: z.string().min(1),
  amountMinor: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});

export const ledgerAccountSchema = z.object({
  id: z.number().int().nonnegative(),
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  currentBalanceMinor: z.number().int().nonnegative(),
});

export const ledgerScopeSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("all-accounts"),
  }),
  z.object({
    kind: z.literal("account"),
    accountId: z.number().int().positive(),
  }),
]);

export const ledgerScopeSummarySchema = z.object({
  kind: z.enum(["all-accounts", "account"]),
  label: z.string().min(1),
  accountId: z.number().int().positive().optional(),
  accountCount: z.number().int().nonnegative(),
  currentBalanceMinor: z.number().int(),
});

export const categoryInsightSchema = z.object({
  categoryName: z.string().min(1),
  totalAmountMinor: z.number().int(),
  sharePercent: z.number(),
  transactionCount: z.number().int().nonnegative(),
});

export const merchantInsightSchema = z.object({
  merchantOrPayee: z.string().min(1),
  totalAmountMinor: z.number().int(),
  transactionCount: z.number().int().nonnegative(),
  lastSeenDate: z.string().min(1).optional(),
});

export const trendAlertSchema = z.object({
  windowPreset: z.string().min(1),
  currentSpendMinor: z.number().int(),
  baselineSpendMinor: z.number().int(),
  deltaPercent: z.number(),
  thresholdPercent: z.number(),
  isAlert: z.boolean(),
  reason: z.string().min(1),
});

export const runningBalancePointSchema = z.object({
  timestamp: z.string().min(1),
  balanceMinor: z.number().int(),
  deltaMinor: z.number().int(),
  entryId: z.number().int().nonnegative(),
  entryKind: z.string().min(1),
});

export const runningBalanceSchema = z.object({
  windowPreset: z.string().min(1),
  points: z.array(runningBalancePointSchema).default([]),
});

export const insightSummaryCardKindSchema = z.enum(["category", "merchant", "trend"]);

export const insightSummaryCardEmptyStateSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  nextAction: z.string().min(1),
});

export const insightSummaryCardSchema = z.object({
  kind: insightSummaryCardKindSchema,
  title: z.string().min(1),
  headline: z.string().min(1),
  metricLabel: z.string().min(1),
  metricValue: z.string().min(1),
  supportingText: z.string().min(1),
  badgeLabel: z.string().min(1).optional(),
  isEmpty: z.boolean(),
  emptyState: insightSummaryCardEmptyStateSchema,
});

export const ledgerBaselineSchema = z.object({
  scope: ledgerScopeSummarySchema.optional(),
  account: ledgerAccountSchema.nullable(),
  accounts: z.array(ledgerAccountSchema).default([]),
  entries: z.array(ledgerEntrySchema),
  categoryInsights: z.array(categoryInsightSchema).default([]),
  merchantInsights: z.array(merchantInsightSchema).default([]),
  trendAlert: trendAlertSchema,
  runningBalance: runningBalanceSchema,
  insightSummary: z.array(insightSummaryCardSchema).default([]),
  ordering: z.string().min(1),
});

export type LedgerBaselineViewModel = z.infer<typeof ledgerBaselineSchema>;

export function parseCurrencyToMinorUnits(value: string): number {
  const normalized = value.trim();

  if (!currencyPattern.test(normalized)) {
    throw new Error("Opening balance must be a valid amount with up to 2 decimal places.");
  }

  const [wholePart, decimalPart = ""] = normalized.split(".");
  return Number.parseInt(wholePart, 10) * 100 + Number.parseInt(decimalPart.padEnd(2, "0"), 10);
}