import { useState, useEffect, useCallback } from "react";
import { settingsAPI, labResultsAPI } from "../services/api";

// Bulletin affiché sur la carte — par défaut (allowedIds = null), tous les
// points connus apparaissent. Si l'admin a choisi un bulletin précédent (cf.
// AdminPage, onglet "Bulletin sur la carte"), seuls les points rapportés par
// celui-ci restent visibles. Tout nouvel import reprend la main côté serveur
// (cf. routes/labResults.js), donc un simple rechargement suffit à refléter
// le changement sans logique supplémentaire ici.
export function useMapDisplaySelection() {
  const [chosenImportId, setChosenImportId] = useState(null);
  const [recentImports, setRecentImports]   = useState([]);
  const [allowedIds, setAllowedIds]         = useState(null); // null = pas de filtre
  const [loading, setLoading]               = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [setting, imports] = await Promise.all([
        settingsAPI.getMapDisplay().catch(() => ({ importId: null })),
        labResultsAPI.listImports().catch(() => []),
      ]);
      // "Automatique" couvre déjà le plus récent — la liste propose donc
      // les imports actifs suivants, pour revoir n'importe quel bulletin
      // déjà importé (récent ou ancien), pas seulement le tout dernier.
      const active = imports.filter(i => i.status !== "annule").slice(0, 30);
      setRecentImports(active);
      setChosenImportId(setting.importId ?? null);

      if (setting.importId) {
        const ids = await labResultsAPI.getPointsForImport(setting.importId).catch(() => null);
        setAllowedIds(ids ? new Set(ids) : null);
      } else {
        setAllowedIds(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const chooseImport = async (importId) => {
    await settingsAPI.setMapDisplay(importId);
    await load();
  };

  return { allowedIds, chosenImportId, recentImports, loading, chooseImport, reload: load };
}
