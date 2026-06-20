import { useMemo } from "react";
import { useAdminData } from "../context/AdminDataContext";
import { usePoints }    from "../context/PointsContext";
import { getPointOverallLevel } from "../map/labParser.js";

// Seuils réglementaires par type de point (NF EN ISO 18593 / EC 2073/2005)
export const TYPE_SEUIL = { "1": 10, "2": 50, "3": 100, "4": 500 };

const ALERT = {
  critical: { cls: "crit", title: "Action requise",       desc: "Niveau critique – Action corrective immédiate obligatoire" },
  warning:  { cls: "warn", title: "Surveillance requise", desc: "Niveau d'attention – Renforcer la fréquence des contrôles" },
  ok:       { cls: "good", title: "Zone conforme",        desc: "Niveaux dans les limites réglementaires acceptables" },
};

/**
 * Calcule le statut d'un point par rapport à son seuil de type propre.
 * Chaque type de point a un seuil réglementaire différent.
 */
export function pointStatus(ufc, pointType) {
  const seuil = TYPE_SEUIL[pointType] ?? 50;
  if (ufc >= seuil)        return "critical";
  if (ufc >= seuil * 0.8)  return "warning";
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
  const { zones, thresholds, loading, error, ...rest } = useAdminData();
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

        // Statut = pire statut parmi les points mesurés
        let status = "ok";
        if (hasData) {
          for (const pt of statusPoints) {
            const st = pt.importedStatus ?? pointStatus(pt.ufc, pt.pointType);
            if (st === "critical") { status = "critical"; break; }
            if (st === "warning")    status = "warning";
          }
        }

        const alert = ALERT[status];

        // Point avec le ratio ufc/seuil_type le plus élevé (pire cas industriel)
        let worstPct   = 0;
        let worstUfc   = maxUfc ?? 0;
        let worstSeuil = z.seuil || 50;
        if (hasData) {
          for (const pt of measured) {
            const s   = TYPE_SEUIL[pt.pointType] ?? 50;
            const pct = (pt.ufc / s) * 100;
            if (pct > worstPct) {
              worstPct   = pct;
              worstUfc   = pt.ufc;
              worstSeuil = s;
            }
          }
        }

        return {
          ...z,
          ufc:        maxUfc ?? 0,
          status,
          hasData,
          worstPct:   Math.round(worstPct),
          worstUfc,
          worstSeuil,
          alertCls:   alert.cls,
          alertTitle: alert.title,
          alertDesc:  alert.desc,
        };
      });
  }, [zones, pointsByZone, activeResults]);

  return { computedZones, thresholds, loading, error, ...rest };
}
