const features = [
  {
    title: 'Run on your own hardware',
    body: 'Keep your photos and videos on storage you control, not somebody else’s cloud.',
  },
  {
    title: 'Fast web app',
    body: 'A clean browser experience for browsing, viewing, and managing your personal media library.',
  },
  {
    title: 'Android app',
    body: 'Upload, browse, and carry your library with you while the mobile client keeps improving.',
  },
  {
    title: 'Bulk uploads',
    body: 'Drop full folders, large batches, and mixed media imports without building your own workflow around it.',
  },
  {
    title: 'Albums and tags',
    body: 'Organize memories your way as DRFT grows from a gallery into a fuller personal media home.',
  },
  {
    title: 'Private by design',
    body: 'Your data. Your server. Your rules. DRFT is built for self-hosting first.',
  },
]

const stats = [
  { value: 'Self-hosted', label: 'private media cloud' },
  { value: 'Web + Android', label: 'browse anywhere' },
  { value: 'Bulk imports', label: 'folder-friendly uploads' },
]

export default function App() {
  return (
    <div className="page-shell">
      <div className="background-grid" />
      <header className="topbar">
        <a className="brand" href=".">
          <span className="brand-mark">D</span>
          <span className="brand-copy">
            <strong>DRFT</strong>
            <small>Private media cloud</small>
          </span>
        </a>
        <nav className="top-actions">
          <a className="ghost-link" href="https://github.com/satya-sudo/DRFT">
            GitHub
          </a>
          <a className="ghost-link" href="https://github.com/satya-sudo/DRFT/tree/main/docs">
            Docs
          </a>
        </nav>
      </header>

      <main className="hero-layout">
        <section className="hero-copy">
          <p className="eyebrow">Self-hosted photo & video gallery</p>
          <h1>Own your media library without giving up a polished experience.</h1>
          <p className="lede">
            DRFT is a private media cloud for people who want fast browsing, bulk uploads,
            responsive web access, and a mobile companion without handing their memories to
            somebody else’s platform.
          </p>

          <div className="cta-row">
            <a className="primary-cta" href="https://github.com/satya-sudo/DRFT">
              View project
            </a>
            <a className="secondary-cta" href="https://github.com/satya-sudo/DRFT/tree/main/docs">
              Read docs
            </a>
          </div>

          <div className="stats-grid">
            {stats.map((stat) => (
              <article key={stat.label} className="stat-card">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>

          <div className="feature-list">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card">
                <div className="feature-icon" />
                <div>
                  <h2>{feature.title}</h2>
                  <p>{feature.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="visual-stage" aria-label="DRFT product preview">
          <div className="image-frame">
            <img
              src="./drft-hero.png"
              alt="DRFT product preview showing the web and Android interfaces."
            />
          </div>
          <div className="visual-caption">
            <span>Built for your server</span>
            <span>Fast browsing</span>
            <span>Bulk-friendly workflow</span>
          </div>
        </section>
      </main>
    </div>
  )
}
