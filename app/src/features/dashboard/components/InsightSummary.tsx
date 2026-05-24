import type {
  LedgerCategoryInsightData,
  LedgerMerchantInsightData,
} from "../../ledger/service";
import { StoryCard } from "./StoryCard";

type InsightSummaryProps = {
  categoryInsights: LedgerCategoryInsightData[];
  merchantInsights: LedgerMerchantInsightData[];
};

export function InsightSummary({ categoryInsights, merchantInsights }: InsightSummaryProps) {
  return (
    <section className="insight-summary" aria-label="Current spending insights">
      <StoryCard
        title="Category dominance"
        subtitle="Where most debit spend is concentrated this period."
        emptyState="No persisted debit transactions in this period yet."
        rows={categoryInsights.map((insight) => ({
          label: humanizeCategory(insight.categoryName),
          value: formatMinorUnits(insight.totalAmountMinor),
          meta: `${insight.transactionCount} transactions | ${insight.sharePercent.toFixed(1)}% share`,
        }))}
      />
      <StoryCard
        title="Merchant focus"
        subtitle="Top merchants by persisted debit amount."
        emptyState="No merchant activity available for this period yet."
        rows={merchantInsights.map((insight) => ({
          label: insight.merchantOrPayee,
          value: formatMinorUnits(insight.totalAmountMinor),
          meta: `${insight.transactionCount} transactions${insight.lastSeenDate ? ` | Last seen ${insight.lastSeenDate}` : ""}`,
        }))}
      />
    </section>
  );
}

function formatMinorUnits(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function humanizeCategory(category: string): string {
  return category
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
