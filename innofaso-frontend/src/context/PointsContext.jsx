import { createContext, useContext, useState, useEffect } from "react";
import { pointsAPI } from "../services/api";

const PointsContext = createContext(null);

function toFrontend(p) {
  return {
    id:          p.id,
    zoneMapId:   p.zone_map_id,
    label:       p.label,
    x:           Number(p.x),
    y:           Number(p.y),
    pointType:   p.point_type,
    description: p.description,
    ufc:         p.ufc !== null && p.ufc !== undefined ? Number(p.ufc) : null,
  };
}

export function PointsProvider({ children }) {
  const [points,  setPoints]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await pointsAPI.getAll();
      setPoints(data.map(toFrontend));
    } catch {
      // Si le backend n'est pas dispo, on utilise les points statiques (fallback dans FactoryMap)
    } finally {
      setLoading(false);
    }
  };

  // Record<zoneMapId, SamplingPoint[]> — format attendu par FactoryMap
  const pointsByZone = points.reduce((acc, p) => {
    const { zoneMapId, ...pt } = p;
    if (!acc[zoneMapId]) acc[zoneMapId] = [];
    acc[zoneMapId].push(pt);
    return acc;
  }, {});

  // Record<zoneMapId, number|null> — UFC max par zone (null si aucune valeur saisie)
  const ufcByZone = Object.fromEntries(
    Object.entries(pointsByZone).map(([zoneId, pts]) => {
      const measured = pts.filter(p => p.ufc !== null).map(p => p.ufc);
      return [zoneId, measured.length > 0 ? Math.max(...measured) : null];
    })
  );

  const addPoint = async (data) => {
    const created = await pointsAPI.create(data);
    setPoints(prev => [...prev, toFrontend(created)]);
  };

  const updatePoint = async (id, data) => {
    const updated = await pointsAPI.update(id, data);
    setPoints(prev => prev.map(p => p.id === id ? toFrontend(updated) : p));
  };

  const deletePoint = async (id) => {
    await pointsAPI.remove(id);
    setPoints(prev => prev.filter(p => p.id !== id));
  };

  return (
    <PointsContext.Provider value={{ points, pointsByZone, ufcByZone, addPoint, updatePoint, deletePoint, loading, reload: load }}>
      {children}
    </PointsContext.Provider>
  );
}

export function usePoints() {
  return useContext(PointsContext);
}
