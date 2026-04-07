import { createContext, useContext, useEffect, useState } from "react";
import {
  clearStoredSessionToken,
  getStoredSessionToken,
  persistSessionToken
} from "../lib/auth/session";
import * as authApi from "../lib/api/auth";
import * as setupApi from "../lib/api/setup";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [token, setToken] = useState(getStoredSessionToken());
  const [user, setUser] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    setBooting(true);

    try {
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
      clearStoredSessionToken();
      setToken(null);
      setUser(null);
    } finally {
      setBooting(false);
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
