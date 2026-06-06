import { useEffect } from "react";
import { ZONES, KPI_DETAILS } from "../data/zones";
import Icon from "./Icon";

// Overlay sombre derrière le modal
function Overlay({ onClose }) {
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    />
  );
}

// Une ligne de zone dans le modal
function ZoneRow({ zone }) {
  const colors = {
    critical: "var(--red)",
    warning:  "var(--orange)",
    ok:       "var(--green)",
  };
  return (
    <div className="modal-zone-row">
      <span
        className="modal-zone-dot"
        style={{ background: colors[zone.status] }}
      />
      <span className="modal-zone-label">{zone.label}</span>
      <span
        className="modal-zone-val"
        style={{ color: colors[zone.status] }}
      >
        {zone.ufc} UFC/cm²
      </span>
    </div>
  );
}

export default function KpiModal({ kpiKey, onClose }) {
  const detail = KPI_DETAILS[kpiKey];

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!detail) return null;

  const relatedZones = ZONES.filter((z) => detail.zones.includes(z.id));

  return (
    <>
      <Overlay onClose={onClose} />

      <div className="modal-box" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header" style={{ borderColor: detail.color }}>
          <div>
            <div className="modal-tag" style={{ color: detail.color }}>
              Détails
            </div>
            <div className="modal-title">{detail.title}</div>
            <div className="modal-desc">{detail.description}</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <Icon name="close" size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Zones concernées */}
        <div className="modal-section">
          <div className="modal-section-title">Zones concernées</div>
          <div className="modal-zones">
            {relatedZones.map((z) => (
              <ZoneRow key={z.id} zone={z} />
            ))}
          </div>
        </div>

        {/* Actions recommandées */}
        <div className="modal-section">
          <div className="modal-section-title">Actions recommandées</div>
          <ul className="modal-actions">
            {detail.actions.map((action, i) => (
              <li key={i} className="modal-action-item">
                <span
                  className="modal-action-num"
                  style={{ background: detail.color }}
                >
                  {i + 1}
                </span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}