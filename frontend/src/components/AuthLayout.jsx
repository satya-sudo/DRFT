import { useApp } from "../context/AppContext";
import DrftLogo from "./DrftLogo";

export default function AuthLayout({ eyebrow, title, description, children }) {
  const { demoMode } = useApp();

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
              <strong>Timeline first</strong>
              <span>Browse photos and videos in a calm, visual flow.</span>
            </article>
            <article className="feature-card">
              <strong>Admin aware</strong>
              <span>Bootstrap the first admin before anyone else gets in.</span>
            </article>
            <article className="feature-card">
              <strong>Backend ready</strong>
              <span>Uses API contracts now and falls back to demo mode safely.</span>
            </article>
          </div>
          {demoMode ? (
            <div className="notice-banner">
              Demo mode is active because the matching backend endpoints are not
              ready yet.
            </div>
          ) : null}
        </div>
        <div className="auth-form surface">{children}</div>
      </div>
    </div>
  );
}
