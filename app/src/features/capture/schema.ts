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

export const correctionMapSchema = z.partialRecord(criticalFieldSchema, z.string());

export const accountMismatchResolutionSchema = z.enum([
  "use-selected-account",
  "use-parsed-account",
]);

export const duplicateDecisionSchema = z.enum([
  "save-as-new",
  "skip-save",
]);

export const saveLifecycleStateSchema = z.enum([
  "idle",
  "validating",
  "blocked",
  "persisting",
  "success",
  "failed",
]);

export const saveGateDecisionDetailsSchema = z.object({
  blockedFields: blockedFieldReasonSchema.array().default([]),
  nextAction: z.string().optional(),
  accountMismatch: z
    .object({
      detected: z.boolean(),
      requiresResolution: z.boolean(),
      parsedBankName: z.string().nullable().optional(),
      parsedAccountNumber: z.string().nullable().optional(),
      selectedBankName: z.string(),
      selectedAccountNumber: z.string(),
    })
    .optional(),
  duplicateCandidate: z
    .object({
      detected: z.boolean(),
      requiresDecision: z.boolean(),
      reason: z.string().optional(),
      fingerprint: z.string().optional(),
    })
    .optional(),
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
export type CorrectionMap = z.infer<typeof correctionMapSchema>;
export type AccountMismatchResolution = z.infer<typeof accountMismatchResolutionSchema>;
export type DuplicateDecision = z.infer<typeof duplicateDecisionSchema>;
export type SaveLifecycleState = z.infer<typeof saveLifecycleStateSchema>;
export type SaveGateDecisionDetails = z.infer<typeof saveGateDecisionDetailsSchema>;

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

export function getSaveLifecycleLabel(state: SaveLifecycleState): string {
  switch (state) {
    case "idle":
      return "Idle";
    case "validating":
      return "Validating save request";
    case "blocked":
      return "Blocked before persistence";
    case "persisting":
      return "Persisting transaction and audit trail";
    case "success":
      return "Save committed successfully";
    case "failed":
      return "Save failed";
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

function parseAmountToMinorUnits(rawValue: string): number | null {
  const normalized = rawValue.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function getFieldValueForCorrection(
  preview: ParsePreviewViewModel,
  field: BlockedFieldReason["field"],
): string {
  switch (field) {
    case "amountMinor":
      return preview.amountMinor === null ? "" : (preview.amountMinor / 100).toFixed(2);
    case "direction":
      return preview.direction ?? "";
    case "transactionDate":
      return preview.transactionDate ?? "";
    case "bankName":
      return preview.bankName ?? "";
    case "accountNumber":
      return preview.accountNumber ?? "";
    case "merchantOrPayee":
      return preview.merchantOrPayee ?? "";
  }
}

function applySingleCorrection(
  preview: ParsePreviewViewModel,
  field: BlockedFieldReason["field"],
  rawValue: string,
): ParsePreviewViewModel {
  const normalized = rawValue.trim();

  switch (field) {
    case "amountMinor":
      return { ...preview, amountMinor: parseAmountToMinorUnits(rawValue) };
    case "direction": {
      const lower = normalized.toLowerCase();
      if (lower === "debit" || lower === "credit") {
        return { ...preview, direction: lower };
      }
      return { ...preview, direction: null };
    }
    case "transactionDate":
      return { ...preview, transactionDate: normalized || null };
    case "bankName":
      return { ...preview, bankName: normalized || null };
    case "accountNumber":
      return { ...preview, accountNumber: normalized || null };
    case "merchantOrPayee":
      return { ...preview, merchantOrPayee: normalized || null };
  }
}

export function applyCorrectionMap(
  preview: ParsePreviewViewModel,
  correctionMap: CorrectionMap,
): ParsePreviewViewModel {
  return criticalFieldOrder.reduce((currentPreview, field) => {
    const nextValue = correctionMap[field];
    if (typeof nextValue !== "string") {
      return currentPreview;
    }
    return applySingleCorrection(currentPreview, field, nextValue);
  }, preview);
}

export function deriveReadinessStateFromBlockedFields(
  blockedFields: ReadonlyArray<BlockedFieldReason>,
): ParsePreviewViewModel["readinessState"] {
  return blockedFields.length === 0 ? "ready" : "needs-review";
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
