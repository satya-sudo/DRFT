import AppShell from "../components/AppShell";

export default function AlbumsPage() {
  return (
    <AppShell
      title="Albums"
      description="Albums are planned for a later DRFT release. For v0.1.0, the focus stays on a stable timeline, uploads, and viewer experience."
    >
      <div className="placeholder-layout">
        <article className="surface placeholder-card">
          <span className="eyebrow">Coming soon</span>
          <h2>Curated collections</h2>
          <p>
            Albums will let you group media intentionally without duplicating files,
            so trips, events, and shortlists can live alongside the main timeline.
          </p>
        </article>

        <article className="surface placeholder-card">
          <span className="eyebrow">Release focus</span>
          <h2>Timeline and uploads first</h2>
          <p>
            For `v0.1.0`, we are keeping the release surface tight and prioritizing
            reliable uploads, fast browsing, and stable image and video viewing.
          </p>
        </article>

        <article className="surface placeholder-card">
          <span className="eyebrow">What comes later</span>
          <h2>Add, remove, and cover albums</h2>
          <p>
            The planned album flow includes lightweight collections, add-from-library
            actions, cover media, and simple management without changing the media model underneath.
          </p>
        </article>
      </div>
    </AppShell>
  );
}
