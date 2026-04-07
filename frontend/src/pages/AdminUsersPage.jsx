import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useApp } from "../context/AppContext";
import * as adminAPI from "../lib/api/admin";

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export default function AdminUsersPage() {
  const { token } = useApp();
  const [users, setUsers] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user"
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [token]);

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");
      const response = await adminAPI.listUsers(token);
      setUsers(response.items);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      const response = await adminAPI.createUser(token, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role
      });

      setUsers((currentValue) => [response.user, ...currentValue]);
      setForm({
        name: "",
        email: "",
        password: "",
        role: "user"
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser(userID) {
    try {
      setError("");
      await adminAPI.deleteUser(token, userID);
      setUsers((currentValue) => currentValue.filter((user) => user.id !== userID));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  const filteredUsers = users.filter((user) => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  });

  return (
    <AppShell
      title="Admin users"
      description="Invite trusted people into DRFT, keep roles clear, and reserve the right to remove access when needed."
      searchValue={searchValue}
      onSearchChange={setSearchValue}
    >
      <div className="admin-layout">
        <form className="surface form-stack admin-form-card" onSubmit={handleCreateUser}>
          <div className="form-header">
            <h2>Add a user</h2>
            <p>Creates a user account that can log in as soon as the backend auth routes are wired.</p>
          </div>

          <label>
            <span>Name</span>
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  name: event.target.value
                }))
              }
              placeholder="New teammate"
            />
          </label>

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
              placeholder="person@drft.local"
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
              placeholder="Temporary password"
            />
          </label>

          <label>
            <span>Role</span>
            <select
              value={form.role}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  role: event.target.value
                }))
              }
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Adding user..." : "Create user"}
          </button>
        </form>

        <section className="surface users-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Access control</span>
              <h2>User directory</h2>
            </div>
            <span className="panel-count">{filteredUsers.length} accounts</span>
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          {loading ? (
            <div className="empty-state">
              <h2>Loading users</h2>
              <p>Fetching the current access list.</p>
            </div>
          ) : (
            <div className="users-table">
              {filteredUsers.map((user) => (
                <article key={user.id} className="user-row">
                  <div className="user-row-main">
                    <div className="user-avatar">{user.name.slice(0, 1)}</div>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>

                  <div className="user-row-meta">
                    <span className="role-pill">{user.role}</span>
                    <small>Created {formatDate(user.createdAt)}</small>
                  </div>

                  <button
                    type="button"
                    className="ghost-button danger-button"
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
