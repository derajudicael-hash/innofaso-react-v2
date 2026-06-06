// src/services/api.js
// Central file for all backend calls

const BASE = "/api";

// ── Token management ─────────────────────────
export function getToken() {
  return localStorage.getItem("innofaso_token");
}

export function setToken(token) {
  localStorage.setItem("innofaso_token", token);
}

export function removeToken() {
  localStorage.removeItem("innofaso_token");
}

// ── Fetch helper ─────────────────────────────
async function request(path, options = {}) {
  const token = getToken();
  const res   = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════
export const authAPI = {
  login: (username, password) =>
    request("/auth/login", {
      method: "POST",
      body:   JSON.stringify({ username, password }),
    }),

  changePassword: (oldPassword, newPassword) =>
    request("/auth/change-password", {
      method: "POST",
      body:   JSON.stringify({ oldPassword, newPassword }),
    }),
};

// ═══════════════════════════════════════════
// ZONES
// ═══════════════════════════════════════════
export const zonesAPI = {
  getAll: () => request("/zones"),

  create: (zone) =>
    request("/zones", {
      method: "POST",
      body:   JSON.stringify(zone),
    }),

  update: (id, zone) =>
    request(`/zones/${id}`, {
      method: "PUT",
      body:   JSON.stringify(zone),
    }),

  remove: (id) =>
    request(`/zones/${id}`, { method: "DELETE" }),
};

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════
export const settingsAPI = {
  getThresholds: () => request("/settings/thresholds"),
  setThresholds: (data) =>
    request("/settings/thresholds", {
      method: "PUT",
      body:   JSON.stringify(data),
    }),

  getSiteInfo: () => request("/settings/site"),
  setSiteInfo: (data) =>
    request("/settings/site", {
      method: "PUT",
      body:   JSON.stringify(data),
    }),
};
