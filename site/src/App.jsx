import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const docs = [
  { slug: 'index', title: 'Docs home' },
  { slug: 'status', title: 'Current status' },
  { slug: 'release-v0.1.0', title: 'Release checklist' },
  { slug: 'architecture', title: 'Architecture' },
  { slug: 'backend', title: 'Backend and API' },
  { slug: 'frontend', title: 'Frontend and UX' },
  { slug: 'setup', title: 'Setup and operations' },
  { slug: 'roadmap', title: 'Roadmap and milestones' },
]

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

function getRoute() {
  const hash = window.location.hash || '#/'
  const normalized = hash.replace(/^#/, '')

  if (normalized === '/docs' || normalized === '/docs/') {
    return { page: 'docs', slug: 'index' }
  }

  if (normalized.startsWith('/docs/')) {
    return { page: 'docs', slug: normalized.replace('/docs/', '') || 'index' }
  }

  return { page: 'home', slug: null }
}

export default function App() {
  const [route, setRoute] = useState(getRoute())

  useEffect(() => {
    const handleHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const currentDoc = useMemo(() => {
    return docs.find((doc) => doc.slug === route.slug) || docs[0]
  }, [route.slug])

  return (
    <div className="page-shell">
      <div className="background-grid" />
      <header className="topbar">
        <a className="brand" href="#/">
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
          <a className="ghost-link" href="#/docs">
            Docs
          </a>
        </nav>
      </header>

      {route.page === 'docs' ? <DocsPage currentDoc={currentDoc} /> : <LandingPage />}
    </div>
  )
}

function LandingPage() {
  return (
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
          <a className="secondary-cta" href="#/docs">
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
  )
}

function DocsPage({ currentDoc }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDoc() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`./docs/${currentDoc.slug}.md`)
        if (!response.ok) {
          throw new Error(`Failed to load ${currentDoc.slug}.md`)
        }
        const markdown = await response.text()
        if (active) {
          setContent(markdown)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Unable to load documentation.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadDoc()

    return () => {
      active = false
    }
  }, [currentDoc.slug])

  return (
    <main className="docs-layout">
      <aside className="docs-sidebar">
        <div className="docs-sidebar-card">
          <p className="eyebrow">Documentation</p>
          <h1>DRFT docs</h1>
          <p className="docs-sidebar-copy">
            Product, setup, release, and roadmap notes rendered inside the landing site.
          </p>
        </div>
        <nav className="docs-nav">
          {docs.map((doc) => (
            <a
              key={doc.slug}
              className={`docs-link ${doc.slug === currentDoc.slug ? 'active' : ''}`}
              href={`#/docs/${doc.slug}`}
            >
              {doc.title}
            </a>
          ))}
        </nav>
      </aside>

      <section className="docs-content-shell">
        <div className="docs-content-head">
          <a className="secondary-cta" href="#/">
            Back to home
          </a>
          <a className="ghost-link" href="https://github.com/satya-sudo/DRFT">
            Repository
          </a>
        </div>

        <article className="docs-article">
          {loading ? <p className="docs-state">Loading documentation…</p> : null}
          {!loading && error ? <p className="docs-state">{error}</p> : null}
          {!loading && !error ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : null}
        </article>
      </section>
    </main>
  )
}
