import { APIError } from "../api/client";
import { buildDemoMedia } from "./media";

const STORAGE_KEY = "drft.demo.state.v1";

function nowISO() {
  return new Date().toISOString();
}

function generateID(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function readState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    const initialState = {
      users: [],
      files: buildDemoMedia()
    };
    writeState(initialState);
    return initialState;
  }

  return JSON.parse(raw);
}

function writeState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createToken(userID) {
  return `demo:${userID}:${Date.now()}`;
}

function getUserFromToken(token) {
  if (!token || !token.startsWith("demo:")) {
    throw new APIError("Invalid session. Please log in again.", { status: 401 });
  }

  const [, userID] = token.split(":");
  const state = readState();
  const user = state.users.find((entry) => entry.id === userID);

  if (!user) {
    throw new APIError("Session expired. Please log in again.", { status: 401 });
  }

  return user;
}

function ensureAdmin(token) {
  const user = getUserFromToken(token);

  if (user.role !== "admin") {
    throw new APIError("Admin access is required for this section.", {
      status: 403
    });
  }

  return user;
}

export async function getSetupStatus() {
  const state = readState();
  return { adminExists: state.users.some((user) => user.role === "admin") };
}

export async function createInitialAdmin(payload) {
  const state = readState();
  const adminExists = state.users.some((user) => user.role === "admin");

  if (adminExists) {
    throw new APIError("An admin already exists for this DRFT instance.", {
      status: 409
    });
  }

  const user = {
    id: generateID("user"),
    email: payload.email.toLowerCase(),
    name: payload.name,
    password: payload.password,
    role: "admin",
    createdAt: nowISO()
  };

  state.users.push(user);
  writeState(state);

  return {
    token: createToken(user.id),
    user: sanitizeUser(user)
  };
}

export async function login(payload) {
  const state = readState();
  const user = state.users.find(
    (entry) =>
      entry.email.toLowerCase() === payload.email.toLowerCase() &&
      entry.password === payload.password
  );

  if (!user) {
    throw new APIError("Incorrect email or password.", { status: 401 });
  }

  return {
    token: createToken(user.id),
    user: sanitizeUser(user)
  };
}

export async function getCurrentUser(token) {
  const user = getUserFromToken(token);
  return { user: sanitizeUser(user) };
}

export async function listFiles(token) {
  getUserFromToken(token);
  const state = readState();
  const items = [...state.files].sort((left, right) =>
    right.takenAt.localeCompare(left.takenAt)
  );

  return { items };
}

export async function listUsers(token) {
  ensureAdmin(token);
  const state = readState();
  const items = [...state.users]
    .map(sanitizeUser)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return { items };
}

export async function createUser(token, payload) {
  ensureAdmin(token);
  const state = readState();
  const email = payload.email.toLowerCase();

  if (state.users.some((entry) => entry.email.toLowerCase() === email)) {
    throw new APIError("A user with that email already exists.", { status: 409 });
  }

  const user = {
    id: generateID("user"),
    email,
    name: payload.name,
    password: payload.password,
    role: payload.role || "user",
    createdAt: nowISO()
  };

  state.users.push(user);
  writeState(state);

  return { user: sanitizeUser(user) };
}

export async function deleteUser(token, userID) {
  const currentUser = ensureAdmin(token);
  const state = readState();
  const targetUser = state.users.find((entry) => entry.id === userID);

  if (!targetUser) {
    throw new APIError("User not found.", { status: 404 });
  }

  if (targetUser.id === currentUser.id) {
    throw new APIError("You cannot remove your own active admin account.", {
      status: 409
    });
  }

  const adminCount = state.users.filter((entry) => entry.role === "admin").length;

  if (targetUser.role === "admin" && adminCount === 1) {
    throw new APIError("DRFT must keep at least one admin account.", {
      status: 409
    });
  }

  state.users = state.users.filter((entry) => entry.id !== userID);
  writeState(state);

  return { success: true };
}
