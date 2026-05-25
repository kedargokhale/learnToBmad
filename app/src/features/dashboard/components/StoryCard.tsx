import type { ReactNode } from "react";
import type { LedgerInsightSummaryCardData } from "../../ledger/service";

type StoryCardProps = {
  card: LedgerInsightSummaryCardData;
  visualSlot?: ReactNode;
};

export function StoryCard({ card, visualSlot }: StoryCardProps) {
  return (
    <article className="story-card" aria-label={card.title}>
      <header className="story-card-header">
        <div className="story-card-heading-row">
          <h3>{card.title}</h3>
          {card.badgeLabel ? <span className="story-card-badge">{card.badgeLabel}</span> : null}
        </div>
        <p>{card.supportingText}</p>
      </header>

      <div className="story-card-metric" aria-live="polite">
        <div className="story-card-metric-label">{card.metricLabel}</div>
        <div className="story-card-metric-value">{card.metricValue}</div>
        <div className="story-card-headline">{card.headline}</div>
      </div>

      {visualSlot ?? null}

      {card.isEmpty ? (
        <div className="story-card-empty" role="status">
          <strong>{card.emptyState.title}</strong>
          <p>{card.emptyState.detail}</p>
          <span>{card.emptyState.nextAction}</span>
        </div>
      ) : null}
    </article>
  );
}
