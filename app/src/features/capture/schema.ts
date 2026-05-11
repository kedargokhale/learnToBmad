import { z } from "zod";

export const parseReadinessStateSchema = z.enum(["ready", "needs-review"]);

export const criticalFieldSchema = z.enum([
  "amountMinor",
  "direction",
  "transactionDate",
  "bankName",
  "accountNumber",
  "merchantOrPayee",
]);

export const blockedFieldReasonSchema = z.object({
  field: criticalFieldSchema,
  reason: z.enum(["missing", "ambiguous"]),
  hint: z.string().min(1),
});

export const criticalFieldOrder = criticalFieldSchema.options;

export const parsePreviewSchema = z.object({
  rawText: z.string().min(1),
  normalizedText: z.string().min(1),
  amountMinor: z.number().int().nonnegative().nullable(),
  direction: z.enum(["debit", "credit"]).nullable(),
  transactionDate: z.string().nullable(),
  bankName: z.string().nullable(),
  accountNumber: z.string().nullable(),
  merchantOrPayee: z.string().nullable(),
  readinessState: parseReadinessStateSchema,
});

export type ParsePreviewViewModel = z.infer<typeof parsePreviewSchema>;
export type BlockedFieldReason = z.infer<typeof blockedFieldReasonSchema>;

export function formatCurrency(amountMinor: number | null): string {
  if (amountMinor === null) return "-";
  const amountMajor = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amountMajor);
}

export function computeReadinessLabel(readinessState: ParsePreviewViewModel["readinessState"]): string {
  switch (readinessState) {
    case "ready":
      return "Ready for validation";
    case "needs-review":
      return "Needs review before save";
  }
}

export function getFieldDisplayName(field: BlockedFieldReason["field"]): string {
  switch (field) {
    case "amountMinor":
      return "Amount";
    case "direction":
      return "Direction";
    case "transactionDate":
      return "Transaction date";
    case "bankName":
      return "Bank";
    case "accountNumber":
      return "Account";
    case "merchantOrPayee":
      return "Merchant/Payee";
  }
}

function isAmbiguousText(value: string): boolean {
  const lowered = value.trim().toLowerCase();
  if (!lowered) return true;

  const exactAmbiguous = new Set(["unknown", "ambiguous", "n/a", "na", "tbd", "-", "--"]);
  return exactAmbiguous.has(lowered) || lowered.includes("unknown") || lowered.includes("ambiguous");
}

function isYyyyMmDd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function deriveBlockedFieldReasons(
  preview: ParsePreviewViewModel | null,
): BlockedFieldReason[] {
  if (!preview) {
    return criticalFieldOrder.map((field) => ({
      field,
      reason: "missing",
      hint: "Parse a bank message to populate this field before save.",
    }));
  }

  const blocked: BlockedFieldReason[] = [];

  if (preview.amountMinor === null) {
    blocked.push({
      field: "amountMinor",
      reason: "missing",
      hint: "Parse or enter the transaction amount from the source message.",
    });
  } else if (preview.amountMinor <= 0) {
    blocked.push({
      field: "amountMinor",
      reason: "ambiguous",
      hint: "Amount must be a positive value.",
    });
  }

  if (!preview.direction) {
    blocked.push({
      field: "direction",
      reason: "missing",
      hint: "Direction must be debit or credit.",
    });
  }

  if (!preview.transactionDate) {
    blocked.push({
      field: "transactionDate",
      reason: "missing",
      hint: "Provide transaction date in YYYY-MM-DD.",
    });
  } else if (!isYyyyMmDd(preview.transactionDate)) {
    blocked.push({
      field: "transactionDate",
      reason: "ambiguous",
      hint: "Use an unambiguous date in YYYY-MM-DD format.",
    });
  }

  if (!preview.bankName?.trim()) {
    blocked.push({
      field: "bankName",
      reason: "missing",
      hint: "Provide the bank name from the source message.",
    });
  } else if (isAmbiguousText(preview.bankName)) {
    blocked.push({
      field: "bankName",
      reason: "ambiguous",
      hint: "Replace placeholder bank text with the exact bank name.",
    });
  }

  if (!preview.accountNumber?.trim()) {
    blocked.push({
      field: "accountNumber",
      reason: "missing",
      hint: "Provide the masked account/card identifier from the source message.",
    });
  } else if (isAmbiguousText(preview.accountNumber)) {
    blocked.push({
      field: "accountNumber",
      reason: "ambiguous",
      hint: "Replace placeholder account text with the exact identifier.",
    });
  }

  if (!preview.merchantOrPayee?.trim()) {
    blocked.push({
      field: "merchantOrPayee",
      reason: "missing",
      hint: "Provide the merchant or payee from the source message.",
    });
  } else if (isAmbiguousText(preview.merchantOrPayee)) {
    blocked.push({
      field: "merchantOrPayee",
      reason: "ambiguous",
      hint: "Replace placeholder merchant/payee text with the exact value.",
    });
  }

  return blocked;
}
