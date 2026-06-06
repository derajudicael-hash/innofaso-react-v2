import { useAdminData } from "../context/AdminDataContext";

const PAGE_META = {
  dashboard: { title: "Tableau de bord",  sub: "Surveillance temps réel · Usine Plumpy'Nut La Grâce" },
  carto:     { title: "Cartographie",     sub: "Plan interactif · 21 zones · 34 points de prélèvement" },
  history:   { title: "Historique",       sub: "Évolution des niveaux microbiologiques par zone" },
  alerts:    { title: "Alertes actives",  sub: "Zones en dépassement ou sous surveillance renforcée" },
  settings:  { title: "Paramètres",       sub: "Configuration des seuils et informations du site" },
  admin:     { title: "Administration",   sub: "Gestion des zones, utilisateurs et données" },
};

function CriticalBadge({ count }) {
  if (count === 0) return null;
  return (
    <div className="topbar-crit-badge">
      <span className="topbar-crit-dot" />
      {count} zone{count > 1 ? "s" : ""} critique{count > 1 ? "s" : ""}
    </div>
  );
}

export default function Topbar({ clock, activeNav }) {
  const { zones } = useAdminData();
  const critCount = zones.filter((z) => z.status === "critical").length;
  const page = PAGE_META[activeNav] ?? PAGE_META.dashboard;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{page.title}</h1>
        <p className="topbar-sub">{page.sub}</p>
      </div>

      <div className="topbar-center">
        <CriticalBadge count={critCount} />
      </div>

      <div className="topbar-right">
        <span className="topbar-label">Actualisation</span>
        <span className="topbar-clock">{clock}</span>
      </div>
    </header>
  );
}
