import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import SetupAdminPage from "./pages/SetupAdminPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PhotosPage from "./pages/PhotosPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import DevicesPage from "./pages/DevicesPage";
import NotFoundPage from "./pages/NotFoundPage";
import { useApp } from "./context/AppContext";

function SplashScreen() {
	return (
		<div className="splash-screen">
			<div className="splash-panel">
				<span className="eyebrow">DRFT</span>
				<h1>Preparing your private media cloud</h1>
        <p>
          Loading setup status, checking your session, and getting the frontend
          ready.
        </p>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { adminExists, user } = useApp();

  if (!adminExists) {
    return <Navigate replace to="/setup/admin" />;
  }

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  return <Navigate replace to="/photos" />;
}

function SetupOnlyRoute({ children }) {
  const { adminExists, user } = useApp();

  if (adminExists) {
    return <Navigate replace to={user ? "/photos" : "/login"} />;
  }

  return children;
}

function GuestRoute({ children }) {
  const { adminExists, user } = useApp();

  if (!adminExists) {
    return <Navigate replace to="/setup/admin" />;
  }

  if (user) {
    return <Navigate replace to="/photos" />;
  }

  return children;
}

function ProtectedRoute({ children }) {
  const { adminExists, user } = useApp();
  const location = useLocation();

  if (!adminExists) {
    return <Navigate replace to="/setup/admin" />;
  }

  if (!user) {
    return <Navigate replace to="/login" state={{ from: location.pathname }} />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user } = useApp();

  if (!user?.permissions?.canManageUsers) {
    return <Navigate replace to="/photos" />;
  }

  return children;
}

function DeviceManagerRoute({ children }) {
  const { user } = useApp();

  if (!user?.permissions?.canManageDevices) {
    return <Navigate replace to="/photos" />;
  }

  return children;
}

export default function App() {
  const { booting } = useApp();

  if (booting) {
    return <SplashScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/setup/admin"
        element={
          <SetupOnlyRoute>
            <SetupAdminPage />
          </SetupOnlyRoute>
        }
      />
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <GuestRoute>
            <ResetPasswordPage />
          </GuestRoute>
        }
      />
      <Route
        path="/photos"
        element={
          <ProtectedRoute>
            <PhotosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/devices"
        element={
          <ProtectedRoute>
            <DeviceManagerRoute>
              <DevicesPage />
            </DeviceManagerRoute>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
