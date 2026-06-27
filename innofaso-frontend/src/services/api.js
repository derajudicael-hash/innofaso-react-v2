// "/api" passe par le proxy Vite (dev) ou suppose front/back sur le même
// domaine (prod derrière un reverse-proxy). Si front et back sont déployés
// sur des domaines séparés, définir VITE_API_URL (ex: https://api.mondomaine.com/api).
const BASE = import.meta.env.VITE_API_URL || "/api";

// ── Token management ─────────────────────────
export function getToken()        { return localStorage.getItem("innofaso_token"); }
export function setToken(token)   { localStorage.setItem("innofaso_token", token); }
export function removeToken()     { localStorage.removeItem("innofaso_token"); }

// ── Fetch helper avec timeout et gestion réseau ──
async function request(path, options = {}) {
  const token      = getToken();
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timer);

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Réponse serveur invalide");
    }

    if (!res.ok) throw new Error(data.error || "Erreur serveur");
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Délai dépassé — vérifiez que le serveur backend est démarré (port 4000)");
    }
    if (!navigator.onLine || err.message === "Failed to fetch" || err.message.includes("NetworkError")) {
      throw new Error("Serveur inaccessible — lancez npm run dev et vérifiez que le backend tourne");
    }
    throw err;
  }
}

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════
export const authAPI = {
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),

  changePassword: (oldPassword, newPassword) =>
    request("/auth/change-password", { method: "POST", body: JSON.stringify({ oldPassword, newPassword }) }),
};

// ═══════════════════════════════════════════
// ZONES
// ═══════════════════════════════════════════
export const zonesAPI = {
  getAll: () => request("/zones"),

  create: (zone) =>
    request("/zones", { method: "POST", body: JSON.stringify(zone) }),

  update: (id, zone) =>
    request(`/zones/${id}`, { method: "PUT", body: JSON.stringify(zone) }),

  remove: (id) =>
    request(`/zones/${id}`, { method: "DELETE" }),

  revertSeuilToAuto: (id) =>
    request(`/zones/${id}/seuil/auto`, { method: "POST" }),
};

// ═══════════════════════════════════════════
// POINTS DE PRELEVEMENT
// ═══════════════════════════════════════════
export const pointsAPI = {
  getAll: () => request("/points"),

  create: (pt) =>
    request("/points", { method: "POST", body: JSON.stringify(pt) }),

  update: (id, pt) =>
    request(`/points/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(pt) }),

  remove: (id) =>
    request(`/points/${encodeURIComponent(id)}`, { method: "DELETE" }),

  register: (data) =>
    request("/points/register", { method: "POST", body: JSON.stringify(data) }),
};

// ═══════════════════════════════════════════
// POINTS EN ATTENTE DE PLACEMENT
// ═══════════════════════════════════════════
export const pendingPointsAPI = {
  getAll: () => request("/pending-points"),

  resolve: (id, zoneMapId) =>
    request(`/pending-points/${encodeURIComponent(id)}/resolve`, {
      method: "POST",
      body: JSON.stringify({ zoneMapId }),
    }),

  dismiss: (id) =>
    request(`/pending-points/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════
export const settingsAPI = {
  getSiteInfo: () => request("/settings/site"),
  setSiteInfo: (data) =>
    request("/settings/site", { method: "PUT", body: JSON.stringify(data) }),

  getMapDisplay: () => request("/settings/map-display"),
  setMapDisplay: (importId) =>
    request("/settings/map-display", { method: "PUT", body: JSON.stringify({ importId }) }),
};

// ═══════════════════════════════════════════
// LAB RESULTS (Import from files)
// ═══════════════════════════════════════════
export const labResultsAPI = {
  import: (results, filename) =>
    request("/lab-results/import", { method: "POST", body: JSON.stringify({ results, filename }) }),

  listImports: () => request("/lab-results/imports"),

  undoImport: (importId) =>
    request(`/lab-results/${encodeURIComponent(importId)}/undo`, { method: "POST" }),

  deleteImport: (importId) =>
    request(`/lab-results/${encodeURIComponent(importId)}`, { method: "DELETE" }),

  getPointsForImport: (importId) =>
    request(`/lab-results/${encodeURIComponent(importId)}/points`),

  getPointHistory: (zoneMapId) =>
    request(`/lab-results/history?zoneMapId=${encodeURIComponent(zoneMapId)}`),

  getRetentionStatus: () => request("/lab-results/retention-status"),
};
