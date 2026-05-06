import { z } from "zod";

export const parseReadinessStateSchema = z.enum(["ready", "needs-review"]);

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
