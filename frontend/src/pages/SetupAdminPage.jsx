import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useApp } from "../context/AppContext";

export default function SetupAdminPage() {
  const navigate = useNavigate();
  const { bootstrapAdmin } = useApp();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords need to match before the first admin can be created.");
      return;
    }

    try {
      setSubmitting(true);
      await bootstrapAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password
      });
      navigate("/photos", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(field, value) {
    setForm((currentValue) => ({
      ...currentValue,
      [field]: value
    }));
  }

  return (
    <AuthLayout
      eyebrow="Initial setup"
      title="Create the first administrator"
      description="Set up the first DRFT account for this instance. This account will manage users, storage, and library access."
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-header">
          <h2>Administrator account</h2>
          <p>Choose the primary account that will manage this DRFT installation.</p>
        </div>

        <label>
          <span>Name</span>
          <input
            required
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Satyam"
          />
        </label>

        <label>
          <span>Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="you@drft.local"
          />
        </label>

        <label>
          <span>Password</span>
          <input
            required
            type="password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="Choose a strong password"
          />
        </label>

        <label>
          <span>Confirm password</span>
          <input
            required
            type="password"
            value={form.confirmPassword}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
            placeholder="Repeat the password"
          />
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Creating account..." : "Create administrator"}
        </button>
      </form>
    </AuthLayout>
  );
}
