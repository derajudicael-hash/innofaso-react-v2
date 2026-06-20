// src/context/AdminDataContext.jsx  — VERSION BACKEND + FALLBACK STATIC
import { createContext, useContext, useState, useEffect } from "react";
import { zonesAPI, settingsAPI } from "../services/api";

// Fallback static data for when backend is not available
const FALLBACK_ZONES = [
  { id: 1,  mapId: 'stockage_pf',        label: 'Stockage Produits Finis',  status: 'ok',      ufc: 0,  seuil: 500, responsible: 'Koné Ibrahim',     last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'good', alert_title: 'Zone conforme',  alert_desc: 'Niveaux dans les limites acceptables', history: [0] },
  { id: 2,  mapId: 'conditionnement',    label: 'Conditionnement',           status: 'critical', ufc: 13, seuil: 10,  responsible: 'Sawadogo Marie',    last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'crit', alert_title: 'Action requise', alert_desc: 'Niveau critique – Action corrective immédiate obligatoire', history: [13] },
  { id: 3,  mapId: 'melange',            label: 'Mélange',                   status: 'warning',  ufc: 0,  seuil: 10,  responsible: 'Traoré Amina',      last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'warn', alert_title: 'Surveillance requise', alert_desc: "Niveau d'attention – Renforcer la fréquence des contrôles", history: [0] },
  { id: 4,  mapId: 'premix',             label: 'Pré-Mélange',               status: 'warning',  ufc: 0,  seuil: 10,  responsible: 'Ouédraogo Paul',    last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'warn', alert_title: 'Surveillance requise', alert_desc: "Niveau d'attention – Renforcer la fréquence des contrôles", history: [0] },
  { id: 5,  mapId: 'pesage',             label: 'Pesage poudres',            status: 'critical', ufc: 11, seuil: 10,  responsible: 'Compaoré Jean',     last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'crit', alert_title: 'Action requise', alert_desc: 'Niveau critique – Action corrective immédiate obligatoire', history: [11] },
  { id: 6,  mapId: 'huile',              label: 'Huile et pesage S+A+H',     status: 'ok',      ufc: 0,  seuil: 10,  responsible: 'Non assigné',       last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'good', alert_title: 'Zone conforme',  alert_desc: 'Niveaux dans les limites acceptables', history: [0] },
  { id: 7,  mapId: 'sas_poudres',        label: 'SAS poudres',               status: 'warning',  ufc: 0,  seuil: 100, responsible: 'Non assigné',       last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'warn', alert_title: 'Surveillance requise', alert_desc: "Niveau d'attention – Renforcer la fréquence des contrôles", history: [0] },
  { id: 8,  mapId: 'matieres_premieres', label: 'Matières Premières',        status: 'ok',      ufc: 0,  seuil: 500, responsible: 'Non assigné',       last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'good', alert_title: 'Zone conforme',  alert_desc: 'Niveaux dans les limites acceptables', history: [0] },
  { id: 9,  mapId: 'laverie',            label: 'Laverie + buanderie',       status: 'ok',      ufc: 0,  seuil: 500, responsible: 'Non assigné',       last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'good', alert_title: 'Zone conforme',  alert_desc: 'Niveaux dans les limites acceptables', history: [0] },
  { id: 10, mapId: 'vestiaire_laverie',  label: 'Vestiaire Laverie',         status: 'ok',      ufc: 0,  seuil: 500, responsible: 'Non assigné',       last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'good', alert_title: 'Zone conforme',  alert_desc: 'Niveaux dans les limites acceptables', history: [0] },
  { id: 11, mapId: 'vestiaires_h',       label: 'Vestiaires H',              status: 'ok',      ufc: 0,  seuil: 500, responsible: 'Non assigné',       last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'good', alert_title: 'Zone conforme',  alert_desc: 'Niveaux dans les limites acceptables', history: [0] },
  { id: 12, mapId: 'vestiaires_visiteur',label: 'Vestiaires Visiteur',       status: 'ok',      ufc: 0,  seuil: 500, responsible: 'Non assigné',       last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'good', alert_title: 'Zone conforme',  alert_desc: 'Niveaux dans les limites acceptables', history: [0] },
  { id: 13, mapId: 'vestiaires_f',       label: 'Vestiaires F',              status: 'ok',      ufc: 0,  seuil: 500, responsible: 'Non assigné',       last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'good', alert_title: 'Zone conforme',  alert_desc: 'Niveaux dans les limites acceptables', history: [0] },
  { id: 14, mapId: 'labo_microbiologie', label: 'Labo Microbiologie',        status: 'ok',      ufc: 0,  seuil: 500, responsible: 'Non assigné',       last_check: new Date().toLocaleDateString('fr-FR'), next_check: '—', alert_cls: 'good', alert_title: 'Zone conforme',  alert_desc: 'Niveaux dans les limites acceptables', history: [0] },
];

const FALLBACK_THRESHOLDS = { critical: 50, warning: 40 };
const FALLBACK_SITE_INFO = {
  name: "Usine Plumpy'Nut La Grâce",
  city: "Ouagadougou",
  country: "Burkina Faso",
  contact: "contact@innofaso.bf",
  phone: "+226 00 00 00 00",
};

// Distingue une vraie panne réseau (backend hors-ligne, cf. services/api.js
// `request()`) d'une erreur métier renvoyée par le serveur (ex. seuils
// invalides, droits insuffisants) — seule la première doit basculer en mode
// "local" silencieux ; les autres doivent remonter jusqu'à l'écran appelant
// (cf. même logique dans PointsContext.jsx).
function isNetworkError(err) {
  return err?.message === "Délai dépassé — vérifiez que le serveur backend est démarré (port 4000)" ||
         err?.message === "Serveur inaccessible — lancez npm run dev et vérifiez que le backend tourne";
}

const AdminDataContext = createContext(null);

export function AdminDataProvider({ children }) {
  const [zones,      setZones]        = useState(FALLBACK_ZONES);
  const [thresholds, setThresholdsSt]  = useState(FALLBACK_THRESHOLDS);
  const [siteInfo,   setSiteInfoSt]    = useState(FALLBACK_SITE_INFO);
  const [loading,    setLoading]       = useState(false);
  const [error,      setError]         = useState(null);

  // ── Load everything on mount ──
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [z, t, s] = await Promise.all([
        zonesAPI.getAll().catch(() => null),
        settingsAPI.getThresholds().catch(() => null),
        settingsAPI.getSiteInfo().catch(() => null),
      ]);
      if (z) setZones(z);
      if (t) setThresholdsSt(t);
      if (s) setSiteInfoSt(s);
    } catch (err) {
      // Fallback to static data already set as initial state
      console.info("📡 Backend indisponible — utilisation des données statiques de démonstration");
    } finally {
      setLoading(false);
    }
  };

  // ── ZONES ──
  const addZone = async (zone) => {
    try {
      const created = await zonesAPI.create(zone);
      setZones((prev) => [...prev, created]);
      return created;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Backend hors-ligne : on ajoute localement pour ne pas bloquer l'utilisateur
      const local = { id: Date.now(), ...zone };
      setZones((prev) => [...prev, local]);
      return local;
    }
  };

  const updateZone = async (id, patch) => {
    const existing = zones.find((z) => z.id === id);
    const merged   = { ...existing, ...patch };
    try {
      const updated = await zonesAPI.update(id, {
        label: merged.label,
        ufc: merged.ufc,
        seuil: merged.seuil,
        responsible: merged.responsible,
        lastCheck: merged.lastCheck,
        nextCheck: merged.nextCheck,
      });
      setZones((prev) => prev.map((z) => (z.id === id ? updated : z)));
      return updated;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Backend hors-ligne : on bascule sur l'état local pour ne pas bloquer l'utilisateur
      setZones((prev) => prev.map((z) => (z.id === id ? merged : z)));
      return merged;
    }
  };

  const deleteZone = async (id) => {
    try {
      await zonesAPI.remove(id);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  // ── THRESHOLDS ──
  const setThresholds = async (data) => {
    try {
      const updated = await settingsAPI.setThresholds(data);
      setThresholdsSt(updated);
      const refreshed = await zonesAPI.getAll();
      setZones(refreshed);
      return updated;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      setThresholdsSt(data);
      return data;
    }
  };

  // ── SITE INFO ──
  const setSiteInfo = async (data) => {
    try {
      await settingsAPI.setSiteInfo(data);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
    setSiteInfoSt(data);
  };

  return (
    <AdminDataContext.Provider value={{
      zones, addZone, updateZone, deleteZone,
      thresholds, setThresholds,
      siteInfo, setSiteInfo,
      loading, error, reload: loadAll,
    }}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  return useContext(AdminDataContext);
}