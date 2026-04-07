import AppShell from "../components/AppShell";

export default function DevicesPage() {
  return (
    <AppShell
      title="Devices"
      description="This section is reserved for future session and device management, without forcing us to lock the backend design too early."
    >
      <div className="placeholder-layout">
        <article className="surface placeholder-card">
          <span className="eyebrow">Planned next</span>
          <h2>Connected device registry</h2>
          <p>
            We will later show every signed-in phone, laptop, or browser session
            here with revoke controls and last-seen metadata.
          </p>
        </article>

        <article className="surface placeholder-card">
          <span className="eyebrow">Backend note</span>
          <h2>Design this with token lineage</h2>
          <p>
            The safest future shape is per-device refresh sessions with names,
            issued-at timestamps, revocation, and optional push sync metadata.
          </p>
        </article>

        <article className="surface placeholder-card">
          <span className="eyebrow">Frontend readiness</span>
          <h2>UI is already carved out</h2>
          <p>
            Navigation, layout, and access rules are ready, so we can plug in the
            real device model later without another UI rewrite.
          </p>
        </article>
      </div>
    </AppShell>
  );
}

