import { useState, useMemo } from "react";
import { usePoints }         from "../context/PointsContext";
import { useComputedZones }  from "../hooks/useComputedZones";
import { usePersistedFiles } from "../map/usePersistedFiles.js";
import KpiCard       from "../components/KpiCard";
import ChartSection  from "../components/ChartSection";
import KpiModal      from "../components/KpiModal";
import FactoryMap    from "../map/FactoryMap.jsx";
import MapSidebar    from "../map/MapSidebar.jsx";

export const KPI_DETAILS = {
  critical: {
    title: "Alertes critiques",
    color: "var(--red)",
    description: "Zones ayant dépassé le seuil maximum autorisé.",
    alertCls: "critical",
    actions: [
      "Arrêter immédiatement la production dans la zone concernée",
      "Lancer une procédure de décontamination d'urgence",
      "Notifier le responsable qualité",
      "Documenter l'incident dans le registre",
    ],
  },
  warning: {
    title: "Zones en surveillance",
    color: "var(--orange)",
    description: "Zones dont le niveau est proche du seuil limite.",
    alertCls: "warning",
    actions: [
      "Renforcer la fréquence des contrôles (toutes les 2h)",
      "Vérifier les équipements de nettoyage",
      "Alerter le responsable de zone",
    ],
  },
  ok: {
    title: "Zones conformes",
    color: "var(--green)",
    description: "Zones dont les niveaux sont dans les limites acceptables.",
    alertCls: "ok",
    actions: [
      "Maintenir la fréquence de nettoyage actuelle",
      "Continuer les contrôles selon le planning",
    ],
  },
  avg: {
    title: "Contamination moyenne",
    color: "var(--txt)",
    description: "Moyenne des niveaux UFC/cm² sur l'ensemble des zones.",
    alertCls: "ok",
    actions: [
      "Objectif : maintenir la moyenne sous 30 UFC/cm²",
      "Comparer avec les données historiques",
      "Planifier une réunion hebdomadaire de suivi qualité",
    ],
  },
};

export default function DashboardPage() {
  const { pointsByZone } = usePoints();
  const { activeResults } = usePersistedFiles();
  const { computedZones, loading, error } = useComputedZones(activeResults);

  const [selectedMapZone, setSelectedMapZone] = useState(null);
  const [selectedPoint,   setSelectedPoint]   = useState(null);
  const [openModal, setOpenModal] = useState(null);

  // Repli ultime si une zone n'a aucun seuil propre (cas normalement
  // inatteignable : z.worstSeuil retombe déjà sur z.seuil, toujours défini).
  const critThresh = 50;

  const kpiStats = useMemo(() => {
    const measured = computedZones.filter(z => z.hasData);
    const critCount = computedZones.filter(z => z.status === "critical").length;
    const warnCount = computedZones.filter(z => z.status === "warning").length;
    // Zones non mesurées ≠ conformes : on exclut hasData=false du compte "ok"
    const okCount   = computedZones.filter(z => z.hasData && z.status === "ok").length;
    const avgUfc    = measured.length
      ? Math.round(measured.reduce((a, z) => a + z.ufc, 0) / measured.length)
      : 0;

    // Tendance : évalue l'avant-dernière mesure avec le seuil propre à chaque zone (pas un seuil global)
    const prevCritCount = computedZones.filter(z => {
      if (!z.hasData) return false;
      const prev = z.history?.length >= 2 ? z.history[z.history.length - 2] : z.ufc;
      return prev >= (z.worstSeuil ?? critThresh);
    }).length;
    const prevWarnCount = computedZones.filter(z => {
      if (!z.hasData) return false;
      const prev    = z.history?.length >= 2 ? z.history[z.history.length - 2] : z.ufc;
      const zSeuil  = z.worstSeuil ?? critThresh;
      return prev >= zSeuil * 0.8 && prev < zSeuil;
    }).length;
    const prevOkCount = measured.length - prevCritCount - prevWarnCount;
    const prevAvgUfc  = measured.length
      ? Math.round(measured.reduce((a, z) => {
          const prev = z.history?.length >= 2 ? z.history[z.history.length - 2] : z.ufc;
          return a + prev;
        }, 0) / measured.length)
      : 0;

    return { critCount, warnCount, okCount, avgUfc, prevCritCount, prevWarnCount, prevOkCount, prevAvgUfc };
  }, [computedZones, critThresh]);

  if (loading) return (
    <div className="dash-loading">
      <div className="spinner" />
      Chargement des données…
    </div>
  );
  if (error) return <div className="dash-error">{error}</div>;

  const { critCount, warnCount, okCount, avgUfc, prevCritCount, prevWarnCount, prevOkCount, prevAvgUfc } = kpiStats;

  const kpis = [
    { key: "critical", label: "Alertes critiques",     value: critCount, sub: "Zones en alerte",           iconName: "alert", iconClass: "ic-red",    valueClass: "v-red",    delay: "0.05s", cardCls: "kpi-crit", trend: critCount - prevCritCount, trendIsGood: false },
    { key: "warning",  label: "Zones en surveillance", value: warnCount, sub: "Niveau d'attention requis", iconName: "trend", iconClass: "ic-orange",  valueClass: "v-orange", delay: "0.10s", cardCls: "kpi-warn", trend: warnCount - prevWarnCount, trendIsGood: false },
    { key: "ok",       label: "Zones conformes",       value: okCount,   sub: "Niveaux normaux",           iconName: "check", iconClass: "ic-green",   valueClass: "v-green",  delay: "0.15s", cardCls: "kpi-ok",   trend: okCount - prevOkCount,     trendIsGood: true  },
    { key: "avg",      label: "Contamination moyenne", value: avgUfc,    sub: "UFC/cm² · toutes zones",   iconName: "down",  iconClass: "ic-gray",    valueClass: "v-dark",   delay: "0.20s", cardCls: "kpi-avg",  trend: avgUfc - prevAvgUfc,       trendIsGood: false },
  ];

  const backendZones = computedZones.map(z => ({
    id: z.id, mapId: z.mapId, status: z.status, ufc: z.ufc,
    seuil: z.seuil, label: z.label, hasData: z.hasData,
  }));

  // Zone backend correspondant à la zone de la carte sélectionnée
  const activeBackendZone = selectedMapZone
    ? backendZones.find(bz => bz.mapId === selectedMapZone.id)
    : undefined;

  // Zone pour ChartSection
  const chartZone = activeBackendZone
    ? computedZones.find(z => z.id === activeBackendZone.id)
    : computedZones[0];

  return (
    <>
      {openModal && (
        <KpiModal
          kpiKey={openModal}
          zones={computedZones}
          kpiDetails={KPI_DETAILS}
          onClose={() => setOpenModal(null)}
        />
      )}

      <div className="dashboard-grid">
        {/* KPI row */}
        <div className="kpi-row">
          {kpis.map(({ key, ...rest }) => (
            <KpiCard key={key} {...rest} onIconClick={() => setOpenModal(key)} />
          ))}
        </div>

        {/* Carte + panneau droit */}
        <div className="dash-main">
          {/* Carte interactive */}
          <div className="dash-map">
            <div className="panel map-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Cartographie de l'usine</span>
                {selectedMapZone && (
                  <button
                    onClick={() => { setSelectedMapZone(null); setSelectedPoint(null); }}
                    style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Vue globale
                  </button>
                )}
                {activeResults.size > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--txt2)', background: 'var(--brand-bg)', border: '1px solid var(--brand-bd)', borderRadius: 6, padding: '2px 8px' }}>
                    Bulletin actif
                  </span>
                )}
              </div>
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <FactoryMap
                  results={activeResults}
                  backendZones={backendZones}
                  dynamicPoints={pointsByZone}
                  selectedZone={selectedMapZone}
                  onSelectZone={zone => { setSelectedMapZone(zone); setSelectedPoint(null); }}
                />
              </div>
            </div>
          </div>

          {/* Panneau droit */}
          <div className="dash-side">
            {selectedMapZone ? (
              <>
                {/* Sidebar avec données backend + bulletin */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
                  <MapSidebar
                    zone={selectedMapZone}
                    point={selectedPoint}
                    points={pointsByZone[selectedMapZone?.id] ?? []}
                    results={activeResults}
                    backendZone={activeBackendZone}
                    onClose={() => { setSelectedMapZone(null); setSelectedPoint(null); }}
                    onSelectPoint={pt => setSelectedPoint(pt)}
                    onBackToZone={() => setSelectedPoint(null)}
                  />
                </div>
                {/* Graphique historique pour la zone sélectionnée */}
                {chartZone && (
                  <ChartSection zone={chartZone} />
                )}
              </>
            ) : (
              /* Pas de zone sélectionnée → graphique global première zone */
              computedZones[0] && <ChartSection zone={computedZones[0]} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
