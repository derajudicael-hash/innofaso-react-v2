// src/context/AdminDataContext.jsx  — VERSION BACKEND + FALLBACK STATIC
import { createContext, useContext, useState, useEffect } from "react";
import { zonesAPI, settingsAPI } from "../services/api";

// Structure de zones de secours : uniquement le minimum structurel.
// Pas de ufc/status/history fictifs — useComputedZones recalcule tout
// depuis les données réelles de PointsContext (hasData=false → zones grises).
const FALLBACK_ZONES = [
  { id: 1,  mapId: 'stockage_pf',         label: 'Stockage Produits Finis',    seuil: 500, seuilManual: false, responsible: 'Koné Ibrahim' },
  { id: 2,  mapId: 'conditionnement',     label: 'Conditionnement',             seuil: 10,  seuilManual: false, responsible: 'Sawadogo Marie' },
  { id: 3,  mapId: 'melange',             label: 'Mélange',                     seuil: 10,  seuilManual: false, responsible: 'Traoré Amina' },
  { id: 4,  mapId: 'premix',              label: 'Pré-Mélange',                 seuil: 10,  seuilManual: false, responsible: 'Ouédraogo Paul' },
  { id: 5,  mapId: 'pesage',              label: 'Pesage poudres',              seuil: 10,  seuilManual: false, responsible: 'Compaoré Jean' },
  { id: 6,  mapId: 'huile',               label: 'Huile et pesage S+A+H',       seuil: 10,  seuilManual: false, responsible: 'Non assigné' },
  { id: 7,  mapId: 'sas_poudres',         label: 'SAS poudres',                 seuil: 100, seuilManual: false, responsible: 'Non assigné' },
  { id: 8,  mapId: 'matieres_premieres',  label: 'Matières Premières',          seuil: 500, seuilManual: false, responsible: 'Non assigné' },
  { id: 9,  mapId: 'laverie',             label: 'Laverie + buanderie',         seuil: 500, seuilManual: false, responsible: 'Non assigné' },
  { id: 10, mapId: 'vestiaire_laverie',   label: 'Vestiaire Laverie',           seuil: 500, seuilManual: false, responsible: 'Non assigné' },
  { id: 11, mapId: 'vestiaires_h',        label: 'Vestiaires H',                seuil: 500, seuilManual: false, responsible: 'Non assigné' },
  { id: 12, mapId: 'vestiaires_visiteur', label: 'Vestiaires Visiteur',         seuil: 500, seuilManual: false, responsible: 'Non assigné' },
  { id: 13, mapId: 'vestiaires_f',        label: 'Vestiaires F',                seuil: 500, seuilManual: false, responsible: 'Non assigné' },
  { id: 14, mapId: 'labo_microbiologie',  label: 'Labo Microbiologie',          seuil: 500, seuilManual: false, responsible: 'Non assigné' },
];

const FALLBACK_SITE_INFO = {
  name: "InnoFaso",
  city: "",
  country: "",
  contact: "",
  phone: "",
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
      const [z, s] = await Promise.all([
        zonesAPI.getAll().catch(() => null),
        settingsAPI.getSiteInfo().catch(() => null),
      ]);
      if (z) setZones(z);
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

  // seuilManual (booléen, optionnel) : à passer uniquement quand l'admin
  // vient de confirmer (ou d'annuler) un changement manuel de seuil — cf.
  // ZonesTab. Omis lors d'une modification normale (responsable, libellé).
  const updateZone = async (id, patch, seuilManual) => {
    const existing = zones.find((z) => z.id === id);
    const merged   = { ...existing, ...patch };
    try {
      const updated = await zonesAPI.update(id, {
        label: merged.label,
        ufc: merged.ufc,
        seuil: merged.seuil,
        responsible: merged.responsible,
        ...(typeof seuilManual === "boolean" ? { seuilManual } : {}),
      });
      setZones((prev) => prev.map((z) => (z.id === id ? updated : z)));
      return updated;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Backend hors-ligne : on bascule sur l'état local pour ne pas bloquer l'utilisateur
      const local = typeof seuilManual === "boolean" ? { ...merged, seuilManual } : merged;
      setZones((prev) => prev.map((z) => (z.id === id ? local : z)));
      return local;
    }
  };

  // Repasse le seuil de la zone en mode automatique (le bulletin redevient
  // maître) et le recalcule immédiatement côté serveur.
  const revertZoneSeuil = async (id) => {
    const updated = await zonesAPI.revertSeuilToAuto(id);
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, seuil: updated.seuil, seuilManual: updated.seuilManual } : z)));
    return updated;
  };

  const deleteZone = async (id) => {
    try {
      await zonesAPI.remove(id);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
    setZones((prev) => prev.filter((z) => z.id !== id));
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
      zones, addZone, updateZone, revertZoneSeuil, deleteZone,
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