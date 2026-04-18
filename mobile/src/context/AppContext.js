import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../lib/api/auth";
import * as systemApi from "../lib/api/system";
import {
  clearStoredSessionUser,
  clearStoredSessionToken,
  getStoredSessionToken,
  getStoredSessionUser,
  persistSessionToken,
  persistSessionUser
} from "../lib/auth/session";
import {
  clearStoredApiBaseUrl,
  getStoredApiBaseUrl,
  persistApiBaseUrl,
  setRuntimeApiBaseUrl
} from "../lib/config";
import { useUploadManager } from "./useUploadManager";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [serverSetupOpen, setServerSetupOpen] = useState(false);
  const uploadManager = useUploadManager(token);

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    try {
      const storedApiBaseUrl = await getStoredApiBaseUrl();
      setRuntimeApiBaseUrl(storedApiBaseUrl);
      setApiBaseUrl(storedApiBaseUrl);

      if (!storedApiBaseUrl) {
        setBooting(false);
        return;
      }

      const health = await systemApi.checkServer(storedApiBaseUrl);
      setServerInfo(health);

      const storedToken = await getStoredSessionToken();
      const storedUser = await getStoredSessionUser();

      if (!storedToken) {
        setBooting(false);
        return;
      }

      setToken(storedToken);
      setUser(storedUser);

      const response = await authApi.getCurrentUser(storedToken);
      await persistSessionUser(response.user);
      setUser(response.user);
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        await clearStoredSessionToken();
        await clearStoredSessionUser();
        setToken(null);
        setUser(null);
      }
      setServerInfo(null);
    } finally {
      setBooting(false);
    }
  }

  async function login(payload) {
    const response = await authApi.login(payload);
    await persistSessionToken(response.token);
    await persistSessionUser(response.user);
    setToken(response.token);
    setUser(response.user);
    return response.user;
  }

  async function logout() {
    await clearStoredSessionToken();
    await clearStoredSessionUser();
    setToken(null);
    setUser(null);
  }

  async function configureServer(nextApiBaseUrl) {
    const response = await systemApi.checkServer(nextApiBaseUrl);
    const persisted = await persistApiBaseUrl(nextApiBaseUrl);
    setApiBaseUrl(persisted);
    setRuntimeApiBaseUrl(persisted);
    setServerInfo(response);
    setServerSetupOpen(false);
    return response;
  }

  async function refreshServerInfo() {
    if (!apiBaseUrl) {
      setServerInfo(null);
      return null;
    }

    try {
      const response = await systemApi.checkServer(apiBaseUrl);
      setServerInfo(response);
      return response;
    } catch (error) {
      setServerInfo(null);
      throw error;
    }
  }

  async function clearServerConfig() {
    await clearStoredSessionToken();
    await clearStoredSessionUser();
    await clearStoredApiBaseUrl();
    setApiBaseUrl("");
    setToken(null);
    setUser(null);
    setServerInfo(null);
    setServerSetupOpen(false);
  }

  function openServerSetup() {
    setServerSetupOpen(true);
  }

  function closeServerSetup() {
    setServerSetupOpen(false);
  }

  return (
    <AppContext.Provider
      value={{
        booting,
        apiBaseUrl,
        token,
        user,
        serverInfo,
        serverSetupOpen,
        login,
        logout,
        configureServer,
        clearServerConfig,
        openServerSetup,
        closeServerSetup,
        refreshServerInfo,
        ...uploadManager
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }

  return context;
}
