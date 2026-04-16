import { createContext, useContext, useEffect, useState } from "react";
import {
  clearStoredSessionToken,
  getStoredSessionToken,
  persistSessionToken
} from "../lib/auth/session";
import * as authApi from "../lib/api/auth";
import * as filesApi from "../lib/api/files";
import * as setupApi from "../lib/api/setup";
import * as systemApi from "../lib/api/system";
import { FRONTEND_VERSION } from "../lib/appInfo";

const AppContext = createContext(null);

function createLocalMediaItems(fileList) {
  return Array.from(fileList).map((file) => ({
    id: `local-${file.name}-${file.lastModified}`,
    fileName: file.name.replace(/\.[^.]+$/, ""),
    mediaType: file.type.startsWith("video") ? "video" : "image",
    mimeType: file.type,
    sizeBytes: file.size,
    takenAt: new Date().toISOString(),
    previewUrl: URL.createObjectURL(file),
    localOnly: true
  }));
}

export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [token, setToken] = useState(getStoredSessionToken());
  const [user, setUser] = useState(null);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [localUploadItems, setLocalUploadItems] = useState([]);
  const [uploadQueueOpen, setUploadQueueOpen] = useState(false);
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
      await refreshServerStatus();
      const setupState = await getVerifiedSetupStatus();
      setAdminExists(setupState.adminExists);
      setDemoMode(false);

      if (!token) {
        setUser(null);
        return;
      }

      await validateStoredSession(token);
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        clearStoredSessionToken();
        setToken(null);
        setUser(null);
      } else {
        markServiceUnavailable(error, "Unable to complete DRFT startup checks");
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
      const response = await systemApi.getSystemStatus();

      if (response?.status !== "ok") {
        throw new Error("DRFT health check returned an invalid response");
      }

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
      setServerStatus({
        connected: false,
        checking: false,
        backendVersion: null,
        service: null,
        env: null,
        lastCheckedAt: new Date().toISOString(),
        error: error.message || "Unable to reach DRFT API"
      });
      throw error;
    }
  }

  async function refreshSetupStatus() {
    const setupState = await getVerifiedSetupStatus();
    setAdminExists(setupState.adminExists);
    setDemoMode(false);
    return setupState;
  }

  async function getVerifiedSetupStatus() {
    const setupState = await setupApi.getSetupStatus();

    if (typeof setupState?.adminExists !== "boolean") {
      throw new Error("DRFT setup status is unavailable");
    }

    return setupState;
  }

  async function validateStoredSession(sessionToken) {
    const currentUser = await authApi.getCurrentUser(sessionToken);

    if (!currentUser?.user) {
      throw new Error("DRFT session validation returned an empty response");
    }

    setUser(currentUser.user);
    return currentUser.user;
  }

  function markServiceUnavailable(error, fallbackMessage) {
    setServerStatus((currentValue) => ({
      ...currentValue,
      connected: false,
      checking: false,
      lastCheckedAt: new Date().toISOString(),
      error: error?.message || fallbackMessage
    }));
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

  async function enqueueUploads(fileList) {
    if (!token || !fileList?.length) {
      return;
    }

    const files = Array.from(fileList);
    const previewItems = createLocalMediaItems(files);
    const nextEntries = files.map((file) => ({
      id: `upload-${file.name}-${file.lastModified}`,
      name: file.name,
      sizeBytes: file.size,
      progress: 0,
      status: "uploading",
      error: ""
    }));

    setUploadQueueOpen(true);
    setLocalUploadItems((currentValue) => [...previewItems, ...currentValue]);
    setUploadQueue((currentValue) => [...nextEntries, ...currentValue]);

    for (const file of files) {
      const uploadID = `upload-${file.name}-${file.lastModified}`;

      try {
        await filesApi.uploadFileWithProgress(token, file, (progress) => {
          setUploadQueue((currentValue) =>
            currentValue.map((entry) =>
              entry.id === uploadID ? { ...entry, progress } : entry
            )
          );
        });

        setUploadQueue((currentValue) =>
          currentValue.map((entry) =>
            entry.id === uploadID
              ? { ...entry, progress: 100, status: "done", error: "" }
              : entry
          )
        );
      } catch (error) {
        setUploadQueue((currentValue) =>
          currentValue.map((entry) =>
            entry.id === uploadID
              ? {
                  ...entry,
                  status: "error",
                  error: error.message || "Upload failed"
                }
              : entry
          )
        );
      }
    }

    window.setTimeout(() => {
      setLocalUploadItems((currentValue) =>
        currentValue.filter(
          (item) => !previewItems.some((previewItem) => previewItem.id === item.id)
        )
      );
      setUploadQueue((currentValue) =>
        currentValue.filter(
          (entry) => !nextEntries.some((nextEntry) => nextEntry.id === entry.id)
        )
      );
    }, 1500);
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
        enqueueUploads,
        refreshSetupStatus,
        bootstrapAdmin,
        frontendVersion: FRONTEND_VERSION,
        localUploadItems,
        refreshServerStatus,
        initializeApp,
        serverStatus,
        token,
        uploadQueue,
        uploadQueueOpen,
        setUploadQueueOpen,
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
