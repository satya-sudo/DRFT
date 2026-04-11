import { createContext, useContext, useEffect, useState } from "react";
import {
  clearStoredSessionToken,
  getStoredSessionToken,
  persistSessionToken
} from "../lib/auth/session";
import * as authApi from "../lib/api/auth";
import * as setupApi from "../lib/api/setup";
import * as systemApi from "../lib/api/system";
import { FRONTEND_VERSION } from "../lib/appInfo";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [token, setToken] = useState(getStoredSessionToken());
  const [user, setUser] = useState(null);
  const [serverStatus, setServerStatus] = useState({
    connected: false,
    checking: true,
    backendVersion: null,
    service: null,
    env: null,
    lastCheckedAt: null,
    error: ""
  });

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    const intervalID = window.setInterval(() => {
      refreshServerStatus({ silent: true }).catch(() => {});
    }, 30000);

    return () => window.clearInterval(intervalID);
  }, []);

  async function initializeApp() {
    setBooting(true);

    try {
      await refreshServerStatus().catch(() => {});
      const setupState = await setupApi.getSetupStatus();
      setAdminExists(setupState.adminExists);
      setDemoMode(false);

      if (!token) {
        setBooting(false);
        return;
      }

      const currentUser = await authApi.getCurrentUser(token);
      setUser(currentUser.user);
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        clearStoredSessionToken();
        setToken(null);
        setUser(null);
      }
    } finally {
      setBooting(false);
    }
  }

  async function refreshServerStatus(options = {}) {
    const silent = options.silent === true;

    if (!silent) {
      setServerStatus((currentValue) => ({
        ...currentValue,
        checking: true,
        error: ""
      }));
    }

    try {
      const response = await systemApi.getSystemVersion();
      setServerStatus({
        connected: true,
        checking: false,
        backendVersion: response?.version || null,
        service: response?.service || null,
        env: response?.env || null,
        lastCheckedAt: new Date().toISOString(),
        error: ""
      });
      return response;
    } catch (error) {
      setServerStatus((currentValue) => ({
        ...currentValue,
        connected: false,
        checking: false,
        lastCheckedAt: new Date().toISOString(),
        error: error.message || "Unable to reach DRFT API"
      }));
      throw error;
    }
  }

  async function refreshSetupStatus() {
    const setupState = await setupApi.getSetupStatus();
    setAdminExists(setupState.adminExists);
    setDemoMode(false);
    return setupState;
  }

  async function bootstrapAdmin(payload) {
    const response = await setupApi.createInitialAdmin(payload);
    applySession(response);
    return response.user;
  }

  async function login(payload) {
    const response = await authApi.login(payload);
    applySession(response);
    return response.user;
  }

  function logout() {
    clearStoredSessionToken();
    setToken(null);
    setUser(null);
  }

  function applySession(response) {
    persistSessionToken(response.token);
    setToken(response.token);
    setUser(response.user);
    setAdminExists(true);
    setDemoMode(false);
  }

  return (
    <AppContext.Provider
      value={{
        adminExists,
        booting,
        demoMode,
        login,
        logout,
        refreshSetupStatus,
        bootstrapAdmin,
        frontendVersion: FRONTEND_VERSION,
        refreshServerStatus,
        serverStatus,
        token,
        user
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
}
