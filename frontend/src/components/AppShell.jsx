import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import DrftLogo from "./DrftLogo";
import { Icon } from "./Icons";
import StatusBanner from "./StatusBanner";

const mediaNavigationItems = [
  { to: "/photos", label: "All", icon: "photos" },
  { to: "/photos?filter=image", label: "Images", icon: "photos" },
  { to: "/photos?filter=video", label: "Videos", icon: "devices" },
  { to: "/albums", label: "Albums", icon: "albums" },
  { to: "/tags", label: "Tags", icon: "tags" }
];

const managementNavigationItems = [
  { to: "/admin/users", label: "Users", icon: "users", permission: "canManageUsers" },
  { to: "/devices", label: "Devices", icon: "devices", permission: "canManageDevices" }
];

export default function AppShell({
  title,
  description,
  searchValue,
  onSearchChange,
  actions,
  sidebarContent,
  children
}) {
  const {
    demoMode,
    frontendVersion,
    logout,
    refreshServerStatus,
    serverStatus,
    uploadQueue,
    uploadQueueOpen,
    setUploadQueueOpen,
    user
  } = useApp();
  const location = useLocation();
  const [statusOpen, setStatusOpen] = useState(false);

  const totalUploadBytes = uploadQueue.reduce(
    (sum, upload) => sum + (upload.sizeBytes || 0),
    0
  );
  const activeUploadCount = uploadQueue.filter((upload) => upload.status === "uploading").length;

  function formatBytes(value) {
    if (!Number.isFinite(value) || value < 0) {
      return "Unknown";
    }

    if (value === 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.min(
      Math.floor(Math.log(value) / Math.log(1024)),
      units.length - 1
    );
    const amount = value / 1024 ** exponent;
    const digits = amount >= 100 || exponent === 0 ? 0 : amount >= 10 ? 1 : 2;

    return `${amount.toFixed(digits)} ${units[exponent]}`;
  }

  function isNavItemActive(item) {
    const [pathname, query = ""] = item.to.split("?");
    if (location.pathname !== pathname) {
      return false;
    }

    const currentParams = new URLSearchParams(location.search);
    const targetParams = new URLSearchParams(query);

    for (const [key, value] of targetParams.entries()) {
      if (currentParams.get(key) !== value) {
        return false;
      }
    }

    if ([...targetParams.keys()].length === 0) {
      return !currentParams.get("filter");
    }

    return true;
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <DrftLogo />
          </div>
          <div>
            <strong>DRFT</strong>
            <span>Private media cloud</span>
          </div>
        </div>

        <div className="sidebar-main">
          <nav className="nav-stack">
            <div className="nav-group">
              {mediaNavigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={isNavItemActive(item) ? "nav-link nav-link-active" : "nav-link"}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="nav-divider" />

            <div className="nav-group">
              {managementNavigationItems
                .filter((item) => !item.permission || user?.permissions?.[item.permission])
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={isNavItemActive(item) ? "nav-link nav-link-active" : "nav-link"}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
            </div>
          </nav>

          {sidebarContent ? <div className="sidebar-content surface">{sidebarContent}</div> : null}
        </div>

        <div className="sidebar-footer surface">
          <div className="user-chip">
            <div className="user-avatar">{user?.name?.slice(0, 1) || "D"}</div>
            <div>
              <strong>{user?.name || "DRFT user"}</strong>
              <span>{user?.role || "viewer"}</span>
            </div>
          </div>
          <button type="button" className="ghost-button" onClick={logout}>
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        {demoMode ? (
          <StatusBanner>
            Demo mode is active. The frontend is using browser-backed sample data
            until the Go API endpoints are ready.
          </StatusBanner>
        ) : null}

        <header className="topbar">
          {typeof onSearchChange === "function" ? (
            <label className="search-bar top-search">
              <Icon name="search" />
              <input
                type="search"
                placeholder="Search your library"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
          ) : (
            <div className="page-title-block">
              <h1>{title}</h1>
            </div>
          )}

          <div className="page-toolbar">
            <div className="upload-queue-menu">
              <button
                type="button"
                className={
                  uploadQueueOpen
                    ? "ghost-button upload-queue-toggle upload-queue-toggle-active"
                    : "ghost-button upload-queue-toggle"
                }
                onClick={() => setUploadQueueOpen((currentValue) => !currentValue)}
              >
                <span>Queue</span>
                <span className="upload-queue-count">{uploadQueue.length}</span>
              </button>

              {uploadQueueOpen ? (
                <div className="surface upload-queue-popover">
                  <div className="panel-header">
                    <div>
                      <span className="eyebrow">Uploads</span>
                      <h2>Transfer queue</h2>
                    </div>
                    <span className="panel-count">
                      {activeUploadCount} active • {formatBytes(totalUploadBytes)}
                    </span>
                  </div>
                  {uploadQueue.length > 0 ? (
                    <div className="upload-list">
                      {uploadQueue.map((upload) => (
                        <div key={upload.id} className="upload-row">
                          <div>
                            <strong>{upload.name}</strong>
                            <span>
                              {upload.status === "error"
                                ? upload.error
                                : upload.status === "retrying"
                                  ? upload.error
                                : upload.status === "done"
                                  ? "Done"
                                  : `${upload.progress}%`}
                            </span>
                          </div>
                          <div className="upload-progress">
                            <div style={{ width: `${upload.progress}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="upload-queue-empty">
                      <p>No uploads in progress right now.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="status-menu">
              <button
                type="button"
                className={statusOpen ? "ghost-button status-button status-button-active" : "ghost-button status-button"}
                onClick={() => setStatusOpen((currentValue) => !currentValue)}
              >
                <span
                  className={
                    serverStatus.connected
                      ? "system-status-dot system-status-dot-ok"
                      : "system-status-dot system-status-dot-error"
                  }
                />
                <span>Server</span>
              </button>

              {statusOpen ? (
                <div className="system-status-popover surface">
                  <div className="system-status-header">
                    <strong>Server status</strong>
                    <button
                      type="button"
                      className="status-refresh-button"
                      onClick={() => refreshServerStatus().catch(() => {})}
                    >
                      {serverStatus.checking ? "Checking..." : "Check now"}
                    </button>
                  </div>
                  <div className="system-status-row">
                    <span
                      className={
                        serverStatus.connected
                          ? "system-status-dot system-status-dot-ok"
                          : "system-status-dot system-status-dot-error"
                      }
                    />
                    <strong>{serverStatus.connected ? "Connected" : "Disconnected"}</strong>
                  </div>
                  <div className="system-version-grid">
                    <div>
                      <span>Frontend</span>
                      <strong>v{frontendVersion}</strong>
                    </div>
                    <div>
                      <span>Backend</span>
                      <strong>
                        {serverStatus.backendVersion ? `v${serverStatus.backendVersion}` : "Unknown"}
                      </strong>
                    </div>
                  </div>
                  <div className="system-meta-row">
                    <span>Environment</span>
                    <strong>{serverStatus.env || "Unknown"}</strong>
                  </div>
                  {serverStatus.error ? (
                    <p className="system-status-error">{serverStatus.error}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="page-toolbar-actions">{actions}</div>
          </div>
        </header>

        <div className="page-intro">
          <div>
            <span className="eyebrow">DRFT workspace</span>
            <h1>{title}</h1>
          </div>
          <p>{description}</p>
        </div>

        <section className="page-body">{children}</section>
      </main>
    </div>
  );
}
