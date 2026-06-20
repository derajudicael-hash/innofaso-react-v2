import { useState, useEffect, useCallback } from "react";
import { labResultsAPI } from "../services/api.js";
import { isRandomPointId } from "../map/factoryData.js";
import { assignPointColors } from "../utils/pointColors.js";

// Transforme la réponse brute de GET /lab-results/history en { series,
// randomPoints } — extrait en fonction pure pour être réutilisée à la fois
// par le hook (zone affichée à l'écran) et par l'export Word (toutes les
// zones, hors contexte de hook React).
export function buildSeriesFromRaw(raw) {
  const fixedPoints  = raw.filter(p => !isRandomPointId(p.pointId));
  const randomPoints = raw.filter(p => isRandomPointId(p.pointId));
  const colorMap     = assignPointColors(fixedPoints.map(p => p.pointId));

  const series = fixedPoints.map(p => ({
    pointId:     p.pointId,
    label:       p.label || p.pointId,
    description: p.description,
    pointType:   p.pointType,
    color:       colorMap.get(p.pointId),
    points:      p.series,
  }));

  return { series, randomPoints };
}

// Historique RÉEL par point d'une zone, basé sur point_history (backend) —
// remplace l'ancien useBulletinHistory (localStorage). Sépare les points
// fixes (courbes colorées, Phase 1) des points aléatoires (jamais de courbe,
// affichage distinct uniquement, Phase 2).
export function usePointHistory(zoneMapId) {
  const [raw, setRaw]         = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!zoneMapId) { setRaw([]); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await labResultsAPI.getPointHistory(zoneMapId);
      setRaw(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("usePointHistory error:", err);
      setError(err);
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, [zoneMapId]);

  useEffect(() => { load(); }, [load]);

  const { series, randomPoints } = buildSeriesFromRaw(raw);

  return { series, randomPoints, loading, error, reload: load };
}
