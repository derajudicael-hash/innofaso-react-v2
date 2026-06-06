// src/context/AdminDataContext.jsx  — VERSION BACKEND
import { createContext, useContext, useState, useEffect } from "react";
import { zonesAPI, settingsAPI } from "../services/api";

const AdminDataContext = createContext(null);

export function AdminDataProvider({ children }) {
  const [zones,      setZones]      = useState([]);
  const [thresholds, setThresholdsSt] = useState({ critical: 50, warning: 40 });
  const [siteInfo,   setSiteInfoSt]   = useState({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // ── Load everything on mount ──
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [z, t, s] = await Promise.all([
        zonesAPI.getAll(),
        settingsAPI.getThresholds(),
        settingsAPI.getSiteInfo(),
      ]);
      setZones(z);
      setThresholdsSt(t);
      setSiteInfoSt(s);
    } catch (err) {
      setError("Impossible de charger les données. Vérifiez que le backend est lancé.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── ZONES ──
  const addZone = async (zone) => {
    const created = await zonesAPI.create(zone);
    setZones((prev) => [...prev, created]);
    return created;
  };

  const updateZone = async (id, patch) => {
    // Find existing zone and merge
    const existing = zones.find((z) => z.id === id);
    const merged   = { ...existing, ...patch };
    const updated  = await zonesAPI.update(id, {
      label:       merged.label,
      ufc:         merged.ufc,
      seuil:       merged.seuil,
      responsible: merged.responsible,
      lastCheck:   merged.lastCheck,
      nextCheck:   merged.nextCheck,
    });
    setZones((prev) => prev.map((z) => (z.id === id ? updated : z)));
    return updated;
  };

  const deleteZone = async (id) => {
    await zonesAPI.remove(id);
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  // ── THRESHOLDS ──
  const setThresholds = async (data) => {
    const updated = await settingsAPI.setThresholds(data);
    setThresholdsSt(updated);
    // Reload zones so their status reflects new thresholds
    const refreshed = await zonesAPI.getAll();
    setZones(refreshed);
    return updated;
  };

  // ── SITE INFO ──
  const setSiteInfo = async (data) => {
    await settingsAPI.setSiteInfo(data);
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
