import AppShell from "../components/AppShell";

export default function TagsPage() {
  return (
    <AppShell
      title="Tags"
      description="Tags are held for a later DRFT release. For v0.1.0, we are keeping the shipped experience focused and dependable."
    >
      <div className="placeholder-layout">
        <article className="surface placeholder-card">
          <span className="eyebrow">Coming soon</span>
          <h2>Personal organization layers</h2>
          <p>
            Tags will add a second layer of organization on top of the timeline,
            making it easier to group people, events, and themes across dates.
          </p>
        </article>

        <article className="surface placeholder-card">
          <span className="eyebrow">Release focus</span>
          <h2>Keep the core stable</h2>
          <p>
            This release is centered on the basics working well: authentication,
            uploads, timeline loading, previews, downloads, and playback.
          </p>
        </article>

        <article className="surface placeholder-card">
          <span className="eyebrow">Planned next</span>
          <h2>Manual tags before automatic tags</h2>
          <p>
            The next step is a clean manual tagging model that can later support
            filters, smart suggestions, and automatic tagging without reworking the UI again.
          </p>
        </article>
      </div>
    </AppShell>
  );
}
