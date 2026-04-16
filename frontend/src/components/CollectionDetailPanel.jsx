import MediaGrid from "./MediaGrid";

export default function CollectionDetailPanel({
  error,
  emptySelectionTitle,
  emptySelectionDescription,
  loading,
  loadingTitle,
  loadingDescription,
  selectedID,
  collection,
  headerEyebrow,
  headerTitle,
  headerDescription,
  headerActions,
  helperBanner,
  pickerTitle,
  pickerCount,
  pickerItems,
  onPick,
  emptyCollectionTitle,
  emptyCollectionDescription,
  onSelectItem
}) {
  return (
    <section className="surface library-detail-panel">
      {error ? <div className="form-error">{error}</div> : null}

      {!selectedID ? (
        <div className="empty-state">
          <h2>{emptySelectionTitle}</h2>
          <p>{emptySelectionDescription}</p>
        </div>
      ) : loading || !collection ? (
        <div className="empty-state">
          <h2>{loadingTitle}</h2>
          <p>{loadingDescription}</p>
        </div>
      ) : (
        <div className="library-detail-stack">
          <div className="library-detail-header">
            <div>
              <span className="eyebrow">{headerEyebrow}</span>
              <h2>{headerTitle}</h2>
              <p>{headerDescription}</p>
            </div>
            <div className="library-detail-actions">{headerActions}</div>
          </div>

          {helperBanner}

          {pickerItems.length ? (
            <div className="picker-strip">
              <div className="picker-strip-header">
                <strong>{pickerTitle}</strong>
                <span>{pickerCount}</span>
              </div>
              <div className="picker-chip-row">
                {pickerItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="picker-chip"
                    onClick={() => onPick(item.id)}
                  >
                    {item.fileName}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {collection.items?.length ? (
            <MediaGrid items={collection.items} onSelect={onSelectItem} />
          ) : (
            <div className="empty-state">
              <h2>{emptyCollectionTitle}</h2>
              <p>{emptyCollectionDescription}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
