import Icon from "./Icon";

function ufcColor(ufc, seuil) {
  if (ufc >= seuil)        return "var(--red)";
  if (ufc >= seuil * 0.8)  return "var(--orange)";
  return "var(--green)";
}

function barColor(pct) {
  if (pct >= 100) return "var(--red)";
  if (pct >= 80)  return "var(--orange)";
  return "var(--green)";
}

function InfoRow({ icon, label, value, mono }) {
  return (
    <div className="detail-row">
      <span className="row-key">
        <Icon name={icon} size={12} strokeWidth={2} />
        {label}
      </span>
      <span className="row-val" style={mono ? undefined : { fontFamily: "DM Sans, sans-serif" }}>
        {value}
      </span>
    </div>
  );
}

export default function DetailPanel({ zone }) {
  if (!zone) return null;

  const pct      = Math.min((zone.ufc / zone.seuil) * 100, 100);
  const valColor = ufcColor(zone.ufc, zone.seuil);
  const barClr   = barColor(pct);

  return (
    <div className="panel detail-panel">
      <div className="panel-header">Détails de la zone</div>

      <div className="detail-body">
        <div className="detail-zone-name">{zone.label}</div>

        <div className={`alert-box ${zone.alertCls}`}>
          <div className={`alert-title ${zone.alertCls}`}>
            <Icon name="alert" size={13} strokeWidth={2.5} />
            {zone.alertTitle}
          </div>
          <div className="alert-desc">{zone.alertDesc}</div>
        </div>

        <div className="metrics-row">
          <div className="metric-box">
            <div className="metric-label">Contamination</div>
            <div className="metric-value" style={{ color: valColor }}>{zone.ufc}</div>
            <div className="metric-unit">UFC/cm²</div>
          </div>
          <div className="metric-box">
            <div className="metric-label">Seuil limite</div>
            <div className="metric-value">{zone.seuil}</div>
            <div className="metric-unit">UFC/cm²</div>
          </div>
        </div>

        <div className="progress-wrap">
          <div className="progress-labels">
            <span>{zone.ufc} UFC/cm²</span>
            <span>{Math.round(pct)}% du seuil</span>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${pct}%`, background: barClr }} />
          </div>
        </div>

        <div className="detail-rows">
          <InfoRow icon="calendar" label="Dernier contrôle"  value={zone.lastCheck}   mono />
          <InfoRow icon="user"     label="Responsable"       value={zone.responsible} mono={false} />
          <InfoRow icon="clock"    label="Prochain contrôle" value={zone.nextCheck}   mono />
        </div>

        <button className={`action-btn ${zone.alertCls}`}>
          <Icon name={zone.alertCls === "good" ? "shield-check" : "alert"} size={14} strokeWidth={2.5} />
          {zone.alertCls === "good" ? "Zone validée" : "Lancer une intervention"}
        </button>
      </div>
    </div>
  );
}
