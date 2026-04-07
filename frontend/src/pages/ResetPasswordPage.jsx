import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import * as authApi from "../lib/api/auth";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    password: "",
    confirmPassword: ""
  });

  async function handleRequestCode(event) {
    event.preventDefault();
    setError("");
    setRequestMessage("");

    try {
      setRequestSubmitting(true);
      const response = await authApi.requestPasswordReset({ email: email.trim() });
      setRequestMessage(response.message);
      setCodeSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function handleConfirmReset(event) {
    event.preventDefault();
    setError("");
    setRequestMessage("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords need to match before DRFT can reset the account.");
      return;
    }

    try {
      setConfirmSubmitting(true);
      const response = await authApi.confirmPasswordReset({
        email: email.trim(),
        code: form.code.trim(),
        password: form.password
      });
      setRequestMessage(response.message);
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 900);
    } catch (confirmError) {
      setError(confirmError.message);
    } finally {
      setConfirmSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your DRFT password"
      description="Use the master CLI reset command or request a one-time code by email to regain access to your library."
    >
      <div className="form-stack">
        <form className="form-stack" onSubmit={handleRequestCode}>
          <div className="form-header">
            <h2>Send reset code</h2>
            <p>Enter the email for your DRFT account and we will send a six-digit code.</p>
          </div>

          <label>
            <span>Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@drft.local"
            />
          </label>

          <button type="submit" className="primary-button" disabled={requestSubmitting}>
            {requestSubmitting ? "Sending code..." : "Send code"}
          </button>
        </form>

        {codeSent ? (
          <form className="form-stack reset-confirm-form" onSubmit={handleConfirmReset}>
            <div className="form-header">
              <h2>Enter code and new password</h2>
              <p>Paste the code from your email, then choose a new password for DRFT.</p>
            </div>

            <label>
              <span>Reset code</span>
              <input
                required
                inputMode="numeric"
                value={form.code}
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    code: event.target.value
                  }))
                }
                placeholder="123456"
              />
            </label>

            <label>
              <span>New password</span>
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
                placeholder="Choose a strong password"
              />
            </label>

            <label>
              <span>Confirm new password</span>
              <input
                required
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    confirmPassword: event.target.value
                  }))
                }
                placeholder="Repeat the password"
              />
            </label>

            <button type="submit" className="primary-button" disabled={confirmSubmitting}>
              {confirmSubmitting ? "Resetting password..." : "Reset password"}
            </button>
          </form>
        ) : null}

        {requestMessage ? <div className="notice-banner">{requestMessage}</div> : null}
        {error ? <div className="form-error">{error}</div> : null}

        <Link className="text-link" to="/login">
          Return to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
