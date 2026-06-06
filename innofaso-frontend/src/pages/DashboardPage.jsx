import { useState } from "react";
import { useAdminData } from "../context/AdminDataContext";
import KpiCard      from "../components/KpiCard";
import ChartSection from "../components/ChartSection";
import FactoryMapSVG from "../components/FactoryMapSVG";
import DetailPanel  from "../components/DetailPanel";
import KpiModal     from "../components/KpiModal";

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
  const { zones, loading, error, thresholds } = useAdminData();
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [tab,       setTab]       = useState("7j");
  const [openModal, setOpenModal] = useState(null);

  if (loading) return (
    <div className="dash-loading">
      <div className="spinner" />
      Chargement des données…
    </div>
  );
  if (error) return <div className="dash-error">{error}</div>;

  const critThresh = thresholds?.critical ?? 50;
  const warnThresh = thresholds?.warning  ?? 40;

  const selectedId   = selectedZoneId ?? zones[0]?.id ?? null;
  const selectedZone = zones.find((z) => z.id === selectedId) ?? zones[0];

  // Counts actuels
  const critCount = zones.filter((z) => z.status === "critical").length;
  const warnCount = zones.filter((z) => z.status === "warning").length;
  const okCount   = zones.filter((z) => z.status === "ok").length;
  const avgUfc    = zones.length
    ? Math.round(zones.reduce((a, z) => a + z.ufc, 0) / zones.length)
    : 0;

  // Counts période précédente (avant-dernier point d'historique)
  const prevCritCount = zones.filter((z) => {
    const prev = z.history.length >= 2 ? z.history[z.history.length - 2] : z.ufc;
    return prev >= critThresh;
  }).length;

  const prevWarnCount = zones.filter((z) => {
    const prev = z.history.length >= 2 ? z.history[z.history.length - 2] : z.ufc;
    return prev >= warnThresh && prev < critThresh;
  }).length;

  const prevOkCount  = zones.length - prevCritCount - prevWarnCount;
  const prevAvgUfc   = zones.length
    ? Math.round(zones.reduce((a, z) => {
        const prev = z.history.length >= 2 ? z.history[z.history.length - 2] : z.ufc;
        return a + prev;
      }, 0) / zones.length)
    : 0;

  const kpis = [
    {
      key: "critical", label: "Alertes critiques",     value: critCount,
      sub: "Zones en alerte",           iconName: "alert", iconClass: "ic-red",
      valueClass: "v-red",    delay: "0.05s", cardCls: "kpi-crit",
      trend: critCount - prevCritCount, trendIsGood: false,
    },
    {
      key: "warning",  label: "Zones en surveillance", value: warnCount,
      sub: "Niveau d'attention requis", iconName: "trend", iconClass: "ic-orange",
      valueClass: "v-orange", delay: "0.10s", cardCls: "kpi-warn",
      trend: warnCount - prevWarnCount, trendIsGood: false,
    },
    {
      key: "ok",       label: "Zones conformes",       value: okCount,
      sub: "Niveaux normaux",           iconName: "check", iconClass: "ic-green",
      valueClass: "v-green",  delay: "0.15s", cardCls: "kpi-ok",
      trend: okCount - prevOkCount,     trendIsGood: true,
    },
    {
      key: "avg",      label: "Contamination moyenne", value: avgUfc,
      sub: "UFC/cm² · toutes zones",   iconName: "down",  iconClass: "ic-gray",
      valueClass: "v-dark",   delay: "0.20s", cardCls: "kpi-avg",
      trend: avgUfc - prevAvgUfc,       trendIsGood: false,
    },
  ];

  return (
    <>
      {openModal && (
        <KpiModal
          kpiKey={openModal}
          zones={zones}
          kpiDetails={KPI_DETAILS}
          onClose={() => setOpenModal(null)}
        />
      )}

      <div className="dashboard-grid">
        <div className="kpi-row">
          {kpis.map(({ key, ...rest }) => (
            <KpiCard key={key} {...rest} onIconClick={() => setOpenModal(key)} />
          ))}
        </div>

        <div className="dash-main">
          <div className="dash-map">
            <FactoryMapSVG zones={zones} selectedId={selectedId} onSelect={setSelectedZoneId} />
          </div>
          <div className="dash-side">
            {selectedZone && <DetailPanel zone={selectedZone} />}
            {selectedZone && (
              <ChartSection zone={selectedZone} tab={tab} setTab={setTab} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
