import DrftLogo from "./DrftLogo";

export default function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="auth-copy surface">
          <div className="auth-brand">
            <div className="auth-brand-mark">
              <DrftLogo />
            </div>
            <div>
              <strong>DRFT</strong>
              <span>Private media cloud</span>
            </div>
          </div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="feature-list">
            <article className="feature-card">
              <strong>Private by default</strong>
              <span>Your library stays under your control, on infrastructure you manage.</span>
            </article>
            <article className="feature-card">
              <strong>Built for your archive</strong>
              <span>Photos and videos stay organized in one timeline with albums and tags.</span>
            </article>
            <article className="feature-card">
              <strong>Designed to last</strong>
              <span>Simple authentication, direct uploads, and storage visibility without extra clutter.</span>
            </article>
          </div>
        </div>
        <div className="auth-form surface">{children}</div>
      </div>
    </div>
  );
}
