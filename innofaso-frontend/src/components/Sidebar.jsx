import Icon from "./Icon";
import { NAV_ITEMS } from "../data/zones";
import { useComputedZones } from "../hooks/useComputedZones";
import { usePersistedFiles } from "../map/usePersistedFiles.js";

export default function Sidebar({ activeNav, setActiveNav, onAdminClick, isAdminLoggedIn }) {
  const { activeResults } = usePersistedFiles();
  const { computedZones } = useComputedZones(activeResults);
  const critCount  = computedZones.filter((z) => z.status === "critical").length;
  const warnCount  = computedZones.filter((z) => z.status === "warning").length;
  const alertCount = critCount + warnCount;

  const overallStatus = critCount > 0 ? "critical" : warnCount > 0 ? "warning" : "ok";
  const statusText = critCount > 0
    ? `${critCount} zone${critCount > 1 ? "s" : ""} critique${critCount > 1 ? "s" : ""}`
    : warnCount > 0
    ? `${warnCount} zone${warnCount > 1 ? "s" : ""} en surveillance`
    : "Usine conforme";

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        {/* Logo officiel */}
        <div className="sidebar-header logo-block">
          <div className="logo-image-wrap">
            <img
              src="/innofaso-logo.png"
              alt="InnoFaso"
              className="logo-image"
            />
          </div>
          <div className="logo-text">
            <span>Surveillance Microbiologique</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-content nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={[
                "nav-item",
                activeNav === item.id ? "active" : "",
                item.spacer ? "spacer" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveNav(item.id)}
            >
              <Icon name={item.icon} size={20} strokeWidth={2} />
              <span>{item.label}</span>
              {item.badge !== undefined && alertCount > 0 && item.id === "alerts" && (
                <span className={`nav-badge${critCount > 0 ? " pulse" : ""}`}>
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* Indicateur de statut global */}
          <div className={`sidebar-status-bar ${overallStatus}`}>
            <span className="ssb-dot" />
            <span className="ssb-text">{statusText}</span>
          </div>

          {/* Bouton Admin */}
          <button
            className={[
              "nav-item",
              "admin-nav-btn",
              activeNav === "admin" ? "active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={onAdminClick}
            title={isAdminLoggedIn ? "Ouvrir l'administration" : "Se connecter à l'administration"}
          >
            <svg
              width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Administration</span>
            <span
              className={`admin-nav-dot ${isAdminLoggedIn ? "is-online" : ""}`}
              title={isAdminLoggedIn ? "Connecté" : "Accès restreint"}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
