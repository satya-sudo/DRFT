export default function CollectionListPanel({
  eyebrow,
  title,
  countLabel,
  loadingTitle,
  loadingDescription,
  emptyTitle,
  emptyDescription,
  items,
  loading,
  selectedID,
  onSelect,
  renderItem
}) {
  return (
    <section className="surface library-sidebar-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className="panel-count">{countLabel}</span>
      </div>

      {loading ? (
        <div className="empty-state">
          <h2>{loadingTitle}</h2>
          <p>{loadingDescription}</p>
        </div>
      ) : items.length ? (
        <div className="collection-list">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={
                item.id === selectedID
                  ? "collection-card collection-card-active"
                  : "collection-card"
              }
              onClick={() => onSelect(item.id)}
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
