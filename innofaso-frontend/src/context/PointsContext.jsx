import { createContext, useContext, useState, useEffect } from "react";
import { pointsAPI } from "../services/api";

function toFrontend(p) {
  return {
    id:             p.id,
    zoneMapId:      p.zone_map_id,
    label:          p.label,
    x:              Number(p.x),
    y:              Number(p.y),
    pointType:      p.point_type,
    description:    p.description,
    ufc:            p.ufc !== null && p.ufc !== undefined ? Number(p.ufc) : null,
    lastMeasuredAt: p.last_measured_at ?? null,
  };
}

// Distingue une vraie panne réseau (backend hors-ligne, cf. services/api.js
// `request()`) d'une erreur métier renvoyée par le serveur (ex. ID de point
// déjà utilisé) — seule la première doit basculer en mode "local" silencieux.
function isNetworkError(err) {
  return err?.message === "Délai dépassé — vérifiez que le serveur backend est démarré (port 4000)" ||
         err?.message === "Serveur inaccessible — lancez npm run dev et vérifiez que le backend tourne";
}

// Convertit un payload API (snake_case, cf. routes/points.js) en clés
// frontend (camelCase) pour la mise à jour locale en mode hors-ligne.
function toFrontendPartial(data) {
  const out = {};
  if ("zone_map_id" in data)  out.zoneMapId   = data.zone_map_id;
  if ("label" in data)        out.label       = data.label;
  if ("x" in data)            out.x           = Number(data.x);
  if ("y" in data)            out.y           = Number(data.y);
  if ("point_type" in data)   out.pointType   = data.point_type;
  if ("description" in data)  out.description = data.description;
  if ("ufc" in data)          out.ufc         = data.ufc !== null && data.ufc !== undefined && data.ufc !== "" ? Number(data.ufc) : null;
  return out;
}

const PointsContext = createContext(null);

export function PointsProvider({ children }) {
  const [points,  setPoints]  = useState([]);
  const [loading, setLoading] = useState(true);
  // true si le chargement initial a échoué (backend inaccessible) — plus de
  // repli sur une liste de points codée en dur : on préfère le signaler
  // clairement plutôt que d'afficher silencieusement de fausses données.
  const [error,   setError]   = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await pointsAPI.getAll();
      setPoints(data.map(toFrontend));
      setError(false);
    } catch {
      setError(true);
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

  // Record<zoneMapId, number|null> — UFC max par zone
  const ufcByZone = Object.fromEntries(
    Object.entries(pointsByZone).map(([zoneId, pts]) => {
      const measured = pts.filter(p => p.ufc !== null).map(p => p.ufc);
      return [zoneId, measured.length > 0 ? Math.max(...measured) : null];
    })
  );

  const addPoint = async (data) => {
    try {
      const created = await pointsAPI.create(data);
      setPoints(prev => [...prev, toFrontend(created)]);
      return toFrontend(created);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Backend hors-ligne : on ajoute localement pour ne pas bloquer l'utilisateur
      const local = { id: data.id, ...toFrontendPartial(data) };
      setPoints(prev => [...prev, local]);
      return local;
    }
  };

  const updatePoint = async (id, data) => {
    try {
      const updated = await pointsAPI.update(id, data);
      setPoints(prev => prev.map(p => p.id === id ? toFrontend(updated) : p));
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      setPoints(prev => prev.map(p => p.id === id ? { ...p, ...toFrontendPartial(data) } : p));
    }
  };

  const deletePoint = async (id) => {
    try {
      await pointsAPI.remove(id);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
    setPoints(prev => prev.filter(p => p.id !== id));
  };

  return (
    <PointsContext.Provider value={{ points, pointsByZone, ufcByZone, addPoint, updatePoint, deletePoint, loading, error, reload: load }}>
      {children}
    </PointsContext.Provider>
  );
}

export function usePoints() {
  return useContext(PointsContext);
}