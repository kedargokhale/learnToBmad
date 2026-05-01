import { z } from "zod";

const currencyPattern = /^\d+(?:\.\d{1,2})?$/;

export const accountSetupSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required."),
  accountNumber: z
    .string()
    .trim()
    .min(1, "Account number is required.")
    .regex(/^[A-Za-z0-9\-\/ ]+$/, "Account number can only include letters, numbers, spaces, hyphens, and slashes."),
  openingBalance: z
    .string()
    .trim()
    .min(1, "Opening balance is required.")
    .regex(currencyPattern, "Opening balance must be a valid amount with up to 2 decimal places."),
});

export type AccountSetupFormValues = z.infer<typeof accountSetupSchema>;

export function parseCurrencyToMinorUnits(value: string): number {
  const normalized = value.trim();

  if (!currencyPattern.test(normalized)) {
    throw new Error("Opening balance must be a valid amount with up to 2 decimal places.");
  }

  const [wholePart, decimalPart = ""] = normalized.split(".");
  return Number.parseInt(wholePart, 10) * 100 + Number.parseInt(decimalPart.padEnd(2, "0"), 10);
}