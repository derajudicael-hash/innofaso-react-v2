import { useMemo } from "react";
import { useAdminData } from "../context/AdminDataContext";
import { usePoints }    from "../context/PointsContext";
import { getPointOverallLevel } from "../map/labParser.js";

const ALERT = {
  critical: { cls: "crit", title: "Action requise",       desc: "Niveau critique – Action corrective immédiate obligatoire" },
  warning:  { cls: "warn", title: "Surveillance requise", desc: "Niveau d'attention – Renforcer la fréquence des contrôles" },
  ok:       { cls: "good", title: "Zone conforme",        desc: "Niveaux dans les limites réglementaires acceptables" },
};

/**
 * Calcule le statut d'un point par rapport au seuil de SA ZONE — le seuil
 * n'est plus déterminé par un type de point abstrait (1-4), mais par zone :
 * automatiquement depuis la colonne "Spécifications" du bulletin tant que
 * l'admin ne l'a pas fixé à la main (cf. zones.seuil_manual côté backend).
 */
export function pointStatus(ufc, seuil) {
  const s = seuil ?? 50;
  if (ufc >= s)        return "critical";
  if (ufc >= s * 0.8)  return "warning";
  return "ok";
}

function resultStatus(results) {
  const level = getPointOverallLevel(results);
  if (level === "red" || level === "present") return "critical";
  if (level === "orange") return "warning";
  if (level === "green" || level === "absent") return "ok";
  return null;
}

export function resultUfc(results) {
  const values = results
    .map((r) => r.numericValue)
    .filter((value) => value !== null && value !== undefined);
  return values.length > 0 ? Math.max(...values) : null;
}

/**
 * Hook combinant zones (AdminDataContext) + points (PointsContext).
 *
 * Pour chaque zone physique :
 * - ufc    = max des UFC mesurés parmi ses points (null si aucune mesure)
 * - status = pire statut parmi tous les points mesurés, chacun évalué
 *            par rapport à son seuil réglementaire de type
 * - hasData = true si au moins un point a un UFC saisi
 */
export function useComputedZones(activeResults = null) {
  const { zones, loading, error, ...rest } = useAdminData();
  const { pointsByZone } = usePoints();

  const computedZones = useMemo(() => {
    return zones
      .filter(z => z.mapId)
      .map(z => {
        const pts      = pointsByZone[z.mapId] ?? [];
        const ptsWithResults = activeResults
          ? pts.map((pt) => {
              const results = activeResults.get(pt.id) ?? [];
              const importedUfc = resultUfc(results);
              const importedStatus = results.length > 0 ? resultStatus(results) : null;
              return {
                ...pt,
                ufc: importedUfc ?? pt.ufc,
                importedStatus,
                hasImportedResult: results.length > 0,
              };
            })
          : pts;
        const measured = ptsWithResults.filter(p => p.ufc !== null && p.ufc !== undefined);
        const resultPoints = ptsWithResults.filter(p => p.hasImportedResult);
        const statusPoints = resultPoints.length > 0 ? resultPoints : measured;
        const hasData  = measured.length > 0 || resultPoints.length > 0;

        // UFC max pour affichage
        const maxUfc = hasData ? Math.max(...measured.map(p => p.ufc)) : null;

        const zoneSeuil = z.seuil || 50;

        // Statut = pire statut parmi les points mesurés, tous évalués contre
        // le même seuil (celui de la zone — plus de seuil par type de point).
        let status = "ok";
        if (hasData) {
          for (const pt of statusPoints) {
            const st = pt.importedStatus ?? pointStatus(pt.ufc, zoneSeuil);
            if (st === "critical") { status = "critical"; break; }
            if (st === "warning")    status = "warning";
          }
        }

        const alert = ALERT[status];

        // Point avec le ratio ufc/seuil le plus élevé (pire cas) — le seuil
        // étant désormais constant pour toute la zone, c'est simplement celui
        // qui a l'UFC le plus haut.
        const worstPct   = hasData ? Math.round((maxUfc / zoneSeuil) * 100) : 0;
        const worstUfc   = maxUfc ?? 0;
        const worstSeuil = zoneSeuil;

        return {
          ...z,
          ufc:        maxUfc ?? 0,
          status,
          hasData,
          worstPct,
          worstUfc,
          worstSeuil,
          alertCls:   alert.cls,
          alertTitle: alert.title,
          alertDesc:  alert.desc,
        };
      });
  }, [zones, pointsByZone, activeResults]);

  return { computedZones, loading, error, ...rest };
}
