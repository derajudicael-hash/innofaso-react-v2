import Icon from "./Icon";
import { NAV_ITEMS } from "../data/zones";
import { useAdminData } from "../context/AdminDataContext";

export default function Sidebar({ activeNav, setActiveNav, onAdminClick, isAdminLoggedIn }) {
  const { zones } = useAdminData();
  const critCount  = zones.filter((z) => z.status === "critical").length;
  const warnCount  = zones.filter((z) => z.status === "warning").length;
  const alertCount = critCount + warnCount;

  const overallStatus = critCount > 0 ? "critical" : warnCount > 0 ? "warning" : "ok";
  const statusText = critCount > 0
    ? `${critCount} zone${critCount > 1 ? "s" : ""} critique${critCount > 1 ? "s" : ""}`
    : warnCount > 0
    ? `${warnCount} zone${warnCount > 1 ? "s" : ""} en surveillance`
    : "Usine conforme";

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="logo-block">
        <div className="logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
        </div>
        <div className="logo-text">
          <strong>InnoFaso</strong>
          <span>Surveillance Micro</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="nav-list">
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
            <Icon name={item.icon} size={15} strokeWidth={2} />
            <span>{item.label}</span>
            {item.badge !== undefined && alertCount > 0 && item.id === "alerts" && (
              <span className={`nav-badge${critCount > 0 ? " pulse" : ""}`}>
                {alertCount}
              </span>
            )}
          </button>
        ))}

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
            width="15" height="15" viewBox="0 0 24 24"
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
      </nav>
    </aside>
  );
}
