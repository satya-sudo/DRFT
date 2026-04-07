import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="splash-screen">
      <div className="splash-panel">
        <span className="eyebrow">Not found</span>
        <h1>This page drifted away</h1>
        <p>The route you asked for does not exist in the current DRFT frontend.</p>
        <Link className="primary-button inline-link" to="/">
          Return home
        </Link>
      </div>
    </div>
  );
}
