// ─────────────────────────────────────────────
// ZONES DATA
// ─────────────────────────────────────────────
export const ZONES = [
  {
    id: "production",
    label: "Zone Production",
    status: "critical",
    ufc: 78,
    seuil: 50,
    responsible: "Koné Ibrahim",
    alertTitle: "Action requise",
    alertDesc: "Niveau de contamination critique – Action immédiate requise",
    alertCls: "crit",
    history: [45, 50, 62, 55, 70, 74, 78],
  },
  {
    id: "preparation",
    label: "Zone Préparation",
    status: "warning",
    ufc: 42,
    seuil: 50,
    responsible: "Traoré Amina",
    alertTitle: "Surveillance requise",
    alertDesc: "Niveau proche du seuil – Surveiller l'évolution de près",
    alertCls: "warn",
    history: [30, 35, 38, 40, 38, 41, 42],
  },
  {
    id: "stockage",
    label: "Zone Stockage",
    status: "ok",
    ufc: 15,
    seuil: 50,
    responsible: "Ouédraogo Paul",
    alertTitle: "Zone conforme",
    alertDesc: "Niveaux de contamination dans les limites acceptables",
    alertCls: "good",
    history: [18, 16, 14, 17, 15, 14, 15],
  },
  {
    id: "conditionnement",
    label: "Zone Conditionnement",
    status: "warning",
    ufc: 45,
    seuil: 50,
    responsible: "Sawadogo Marie",
    alertTitle: "Surveillance requise",
    alertDesc: "Niveau élevé – Risque de dépassement du seuil",
    alertCls: "warn",
    history: [25, 30, 35, 40, 38, 43, 45],
  },
  {
    id: "expedition",
    label: "Zone Expédition",
    status: "ok",
    ufc: 12,
    seuil: 50,
    responsible: "Compaoré Jean",
    alertTitle: "Zone conforme",
    alertDesc: "Excellent niveau – Norme respectée",
    alertCls: "good",
    history: [15, 13, 14, 12, 11, 13, 12],
  },
];

// ─────────────────────────────────────────────
// NAV ITEMS
// ─────────────────────────────────────────────
export const NAV_ITEMS = [
  { id: "dashboard", label: "Tableau de bord", icon: "grid" },
  { id: "carto",     label: "Cartographie",    icon: "map" },
  { id: "history",   label: "Historique",      icon: "clock" },
  { id: "alerts",    label: "Alertes",         icon: "bell", badge: 1 },
  { id: "rapport",   label: "Rapport IA",      icon: "bar-chart-2" },
  { id: "settings",  label: "Paramètres",      icon: "settings", spacer: true },
];

export const MAP_LEGEND = [
  { color: "#16a34a", label: "Conforme" },
  { color: "#f97316", label: "Surveillance" },
  { color: "#ef4444", label: "Critique" },
];
export const KPI_DETAILS = {
  critical: {
    title: "Alertes critiques",
    color: "var(--red)",
    description: "Zones ayant dépassé le seuil maximum autorisé de 50 UFC/cm².",
    zones: ["production"],
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
    description: "Zones dont le niveau est entre 80% et 100% du seuil limite.",
    zones: ["preparation", "conditionnement"],
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
    zones: ["stockage", "expedition"],
    actions: [
      "Maintenir la fréquence de nettoyage actuelle",
      "Continuer les contrôles selon le planning",
    ],
  },
  avg: {
    title: "Contamination moyenne",
    color: "var(--txt)",
    description: "Moyenne des niveaux UFC/cm² sur l'ensemble des zones de l'usine.",
    zones: ["production", "preparation", "stockage", "conditionnement", "expedition"],
    actions: [
      "Objectif : maintenir la moyenne sous 30 UFC/cm²",
      "Comparer avec les données historiques de la semaine",
      "Planifier une réunion hebdomadaire de suivi qualité",
    ],
  },
};
