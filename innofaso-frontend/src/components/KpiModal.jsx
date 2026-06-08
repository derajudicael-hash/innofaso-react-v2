import { useEffect } from "react";
import Icon from "./Icon";

function Overlay({ onClose }) {
  return <div className="modal-overlay" onClick={onClose} />;
}

function ZoneRow({ zone }) {
  const colors = { critical: "var(--red)", warning: "var(--orange)", ok: "var(--green)" };
  return (
    <div className="modal-zone-row">
      <span className="modal-zone-dot" style={{ background: colors[zone.status] }} />
      <span className="modal-zone-label">{zone.label}</span>
      <span className="modal-zone-val" style={{ color: colors[zone.status] }}>
        {zone.ufc} UFC/cm²
      </span>
    </div>
  );
}

export default function KpiModal({ kpiKey, zones = [], kpiDetails, onClose }) {
  const detail = kpiDetails?.[kpiKey];

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!detail) return null;

  // Filtrer selon le KPI — zones non mesurées exclues des "conformes" et de la moyenne
  const relatedZones = zones.filter(z => {
    if (kpiKey === "critical") return z.status === "critical";
    if (kpiKey === "warning")  return z.status === "warning";
    if (kpiKey === "ok")       return z.hasData && z.status === "ok";
    if (kpiKey === "avg")      return z.hasData;
    return false;
  });

  return (
    <>
      <Overlay onClose={onClose} />
      <div className="modal-box" role="dialog" aria-modal="true">
        <div className="modal-header" style={{ borderColor: detail.color }}>
          <div>
            <div className="modal-tag" style={{ color: detail.color }}>Détails</div>
            <div className="modal-title">{detail.title}</div>
            <div className="modal-desc">{detail.description}</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <Icon name="close" size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">
            Zones concernées {relatedZones.length === 0 && "— Aucune"}
          </div>
          <div className="modal-zones">
            {relatedZones.map((z) => (
              <ZoneRow key={z.id} zone={z} />
            ))}
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Actions recommandées</div>
          <ul className="modal-actions">
            {detail.actions.map((action, i) => (
              <li key={i} className="modal-action-item">
                <span className="modal-action-num" style={{ background: detail.color }}>
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
