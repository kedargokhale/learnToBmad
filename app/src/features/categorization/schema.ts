export const CATEGORY_TAXONOMY = [
  { code: "groceries", label: "Groceries" },
  { code: "dining", label: "Dining" },
  { code: "transport", label: "Transport" },
  { code: "shopping", label: "Shopping" },
  { code: "utilities", label: "Utilities" },
  { code: "entertainment", label: "Entertainment" },
  { code: "healthcare", label: "Healthcare" },
  { code: "education", label: "Education" },
  { code: "salary", label: "Salary" },
  { code: "investment", label: "Investment" },
  { code: "transfer", label: "Transfer" },
  { code: "other", label: "Other" },
] as const;

export type CategoryCode = (typeof CATEGORY_TAXONOMY)[number]["code"];

export function isCategoryCode(value: string): value is CategoryCode {
  return CATEGORY_TAXONOMY.some((category) => category.code === value);
}

export function categoryLabel(value: string): string {
  const match = CATEGORY_TAXONOMY.find((category) => category.code === value);
  return match ? match.label : value;
}
