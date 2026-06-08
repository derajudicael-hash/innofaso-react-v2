import { useMemo } from "react";
import { useComputedZones } from "../hooks/useComputedZones";
import { useTheme }         from "../context/ThemeContext";
import { ZONES } from "../map/factoryData";

const totalPoints = ZONES.reduce((acc, z) => acc + z.points.length, 0);

const PAGE_META = {
  dashboard: { title: "Tableau de bord",  sub: "Surveillance temps réel · Usine Plumpy'Nut La Grâce" },
  history:   { title: "Historique",       sub: "Évolution des niveaux microbiologiques par zone" },
  alerts:    { title: "Alertes actives",  sub: "Zones en dépassement ou sous surveillance renforcée" },
  settings:  { title: "Paramètres",       sub: "Configuration des seuils et informations du site" },
  admin:     { title: "Administration",   sub: "Gestion des zones, utilisateurs et données" },
};

const THEMES = [
  { id: "blanc",      label: "Blanc" },
  { id: "tbtrack",    label: "TB" },
  { id: "industriel", label: "Ind." },
];

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
  const { computedZones } = useComputedZones();
  const { theme, setTheme } = useTheme();
  const critCount = computedZones.filter((z) => z.status === "critical").length;

  const page = useMemo(() => {
    if (activeNav === "carto") {
      return {
        title: "Cartographie",
        sub: `Plan interactif · ${ZONES.length} zones · ${totalPoints} points de prélèvement`,
      };
    }
    return PAGE_META[activeNav] ?? PAGE_META.dashboard;
  }, [activeNav]);

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
        <div className="theme-switcher" title="Changer le thème">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-btn${theme === t.id ? " theme-btn--active" : ""}`}
              onClick={() => setTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="topbar-clock-block">
          <span className="topbar-label">Actualisation</span>
          <span className="topbar-clock">{clock}</span>
        </div>
      </div>
    </header>
  );
}
