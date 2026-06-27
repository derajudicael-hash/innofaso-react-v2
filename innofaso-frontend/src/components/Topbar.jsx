import { useMemo } from "react";
import { useComputedZones } from "../hooks/useComputedZones";
import { useTheme }         from "../context/ThemeContext";
import { usePersistedFiles } from "../map/usePersistedFiles.js";
import { usePoints } from "../context/PointsContext";
import { ZONES } from "../map/factoryData.js";

const PAGE_META = {
  dashboard: { title: "Tableau de bord",  sub: "Surveillance microbiologique en temps réel · InnoFaso SA" },
  history:   { title: "Historique",       sub: "Évolution des niveaux microbiologiques par zone" },
  alerts:    { title: "Alertes actives",  sub: "Zones en dépassement ou sous surveillance renforcée" },
  settings:  { title: "Paramètres",       sub: "Configuration des seuils et informations du site" },
  admin:     { title: "Administration",   sub: "Gestion des zones, utilisateurs et données" },
};

const THEMES = [
  { id: "blanc",      label: "P", icon: "☀️", desc: "Professionnel" },
  { id: "tbtrack",    label: "TB", icon: "🌊", desc: "TB Track" },
  { id: "industriel", label: "I", icon: "⚙️", desc: "Industriel" },
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
  const { activeResults } = usePersistedFiles();
  const { computedZones } = useComputedZones(activeResults);
  const { theme, setTheme } = useTheme();
  const { points } = usePoints();
  const critCount = computedZones.filter((z) => z.status === "critical").length;

  const page = useMemo(() => {
    if (activeNav === "carto") {
      return {
        title: "Cartographie",
        sub: `Plan interactif · ${ZONES.length} zones · ${points.length} points de prélèvement`,
      };
    }
    return PAGE_META[activeNav] ?? PAGE_META.dashboard;
  }, [activeNav, points.length]);

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
