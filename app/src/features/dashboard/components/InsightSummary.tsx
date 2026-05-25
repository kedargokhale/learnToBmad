import type { LedgerInsightSummaryCardData } from "../../ledger/service";
import { StoryCard } from "./StoryCard";

type InsightSummaryProps = {
  cards?: LedgerInsightSummaryCardData[];
};

const FALLBACK_CARDS: LedgerInsightSummaryCardData[] = [
  {
    kind: "category",
    title: "Category story",
    headline: "No category signal available",
    metricLabel: "Top category spend",
    metricValue: "INR 0.00",
    supportingText: "Debit category concentration appears here after saves are committed.",
    isEmpty: true,
    emptyState: {
      title: "No categorized transactions yet",
      detail: "There are no persisted debit transactions to summarize by category.",
      nextAction: "Save more categorized transactions to unlock this insight.",
    },
  },
  {
    kind: "merchant",
    title: "Merchant story",
    headline: "No merchant signal available",
    metricLabel: "Top merchant spend",
    metricValue: "INR 0.00",
    supportingText: "Merchant concentration appears here after persisted debit activity.",
    isEmpty: true,
    emptyState: {
      title: "No merchant activity yet",
      detail: "There are no eligible merchant rows in persisted debit history.",
      nextAction: "Save additional transactions to build merchant insights.",
    },
  },
  {
    kind: "trend",
    title: "Trend story",
    headline: "No trend signal available",
    metricLabel: "Window delta",
    metricValue: "0.0%",
    supportingText: "Trend movement appears after two comparable debit windows are available.",
    isEmpty: true,
    emptyState: {
      title: "Not enough history for a trend",
      detail: "A deterministic trend requires persisted debit data across baseline and current windows.",
      nextAction: "Save more categorized transactions in this preset window.",
    },
  },
];

const CARD_ORDER: Array<LedgerInsightSummaryCardData["kind"]> = ["category", "merchant", "trend"];

export function InsightSummary({ cards }: InsightSummaryProps) {
  const orderedCards = CARD_ORDER.map((kind) => {
    const fromPayload = cards?.find((card) => card.kind === kind);
    if (fromPayload) {
      return fromPayload;
    }

    return FALLBACK_CARDS.find((card) => card.kind === kind);
  }).filter((card): card is LedgerInsightSummaryCardData => Boolean(card));

  return (
    <section className="insight-summary" aria-label="Current spending insights">
      {orderedCards.map((card) => (
        <StoryCard key={card.kind} card={card} />
      ))}
    </section>
  );
}
