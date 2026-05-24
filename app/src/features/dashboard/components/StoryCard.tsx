type StoryCardProps = {
  title: string;
  subtitle: string;
  rows: Array<{
    label: string;
    value: string;
    meta?: string;
  }>;
  emptyState: string;
};

export function StoryCard({ title, subtitle, rows, emptyState }: StoryCardProps) {
  return (
    <article className="story-card" aria-label={title}>
      <header className="story-card-header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </header>

      {rows.length === 0 ? (
        <div className="story-card-empty" role="status">
          {emptyState}
        </div>
      ) : (
        <ol className="story-card-list">
          {rows.map((row) => (
            <li key={`${row.label}-${row.value}`} className="story-card-item">
              <div>
                <strong>{row.label}</strong>
                {row.meta ? <div className="story-card-meta">{row.meta}</div> : null}
              </div>
              <span>{row.value}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
