import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useApp } from "../context/AppContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useApp();
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      setSubmitting(true);
      await login(form);
      navigate(location.state?.from || "/photos", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to your DRFT library"
      description="Use the admin or invited user account to browse your photos, watch clips, and manage the instance."
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-header">
          <h2>Login</h2>
          <p>Authentication will move seamlessly to JWT-backed API sessions.</p>
        </div>

        <label>
          <span>Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((currentValue) => ({
                ...currentValue,
                email: event.target.value
              }))
            }
            placeholder="you@drft.local"
          />
        </label>

        <label>
          <span>Password</span>
          <input
            required
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((currentValue) => ({
                ...currentValue,
                password: event.target.value
              }))
            }
            placeholder="Your password"
          />
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Signing in..." : "Enter library"}
        </button>

        <Link className="text-link" to="/reset-password">
          Forgot password?
        </Link>
      </form>
    </AuthLayout>
  );
}
