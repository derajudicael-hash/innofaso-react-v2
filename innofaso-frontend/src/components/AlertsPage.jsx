import { useState } from "react";
import { useComputedZones } from "../hooks/useComputedZones";
import { usePersistedFiles } from "../map/usePersistedFiles.js";
import Icon from "./Icon";

const STATUS_LABEL = { critical: "Critique", warning: "Surveillance" };

function SummaryPill({ cls, count, label }) {
  return (
    <div className={`alerts-sum-pill ${cls}`}>
      <span className="alerts-sum-num">{count}</span>
      <span className="alerts-sum-label">{label}</span>
    </div>
  );
}

export default function AlertsPage() {
  const { activeResults } = usePersistedFiles();
  const { computedZones: zones, loading, error } = useComputedZones(activeResults);
  const [filter, setFilter] = useState("all");

  if (loading) return (
    <div className="dash-loading">
      <div className="spinner" />
      Chargement des alertes…
    </div>
  );
  if (error) return <div className="dash-error">{error}</div>;

  const critCount = zones.filter((z) => z.status === "critical").length;
  const warnCount = zones.filter((z) => z.status === "warning").length;
  // Zones non mesurées ≠ conformes : on exclut hasData=false du compte "ok"
  const okCount   = zones.filter((z) => z.hasData && z.status === "ok").length;

  const activeAlerts = zones
    .filter((z) => z.status === "critical" || z.status === "warning")
    .sort((a, b) => {
      // Priorité 1 : critique avant surveillance
      if (a.status === "critical" && b.status !== "critical") return -1;
      if (b.status === "critical" && a.status !== "critical") return 1;
      // Priorité 2 : ratio ufc/seuil_type (pas UFC absolu — 13/10=130% > 320/500=64%)
      return b.worstPct - a.worstPct;
    });

  const filtered =
    filter === "all" ? activeAlerts : activeAlerts.filter((z) => z.status === filter);

  return (
    <div className="alerts-page">

      {/* ── En-tête ── */}
      <div className="alerts-header">
        <div>
          <h2 className="page-title">Alertes actives</h2>
          <p className="page-sub">
            {activeAlerts.length === 0
              ? "Toutes les zones de l'usine sont conformes"
              : `${activeAlerts.length} zone${activeAlerts.length > 1 ? "s" : ""} nécessite${activeAlerts.length > 1 ? "nt" : ""} une attention`}
          </p>
        </div>
        <div className="alerts-summary">
          <SummaryPill cls="critical" count={critCount} label={`Critique${critCount > 1 ? "s" : ""}`} />
          <SummaryPill cls="warning"  count={warnCount} label="Surveillance" />
          <SummaryPill cls="ok"       count={okCount}   label={`Conforme${okCount > 1 ? "s" : ""}`} />
        </div>
      </div>

      {activeAlerts.length === 0 ? (
        <div className="alerts-empty">
          <div className="alerts-empty-icon">
            <Icon name="shield-check" size={28} strokeWidth={1.5} />
          </div>
          <div>
            <strong>Usine conforme</strong>
            <p>Tous les niveaux UFC/cm² sont dans les limites acceptables.</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Filtres ── */}
          <div className="alerts-filters">
            {[
              { key: "all",      label: "Toutes",      count: activeAlerts.length },
              { key: "critical", label: "Critique",     count: critCount },
              { key: "warning",  label: "Surveillance", count: warnCount },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                className={`alerts-filter-btn ${key !== "all" ? key : ""} ${filter === key ? "active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {label}
                <span className="afb-count">{count}</span>
              </button>
            ))}
          </div>

          {/* ── Cartes ── */}
          <div className="alerts-list">
            {filtered.length === 0 ? (
              <p className="alerts-filter-empty">Aucune zone dans cette catégorie.</p>
            ) : (
              filtered.map((z) => {
                // Utilise le point le plus défavorable (ratio ufc/seuil_type max)
                const pct = Math.min(z.worstPct, 999);
                return (
                  <div key={z.id} className={`alert-card-v2 ${z.status}`}>
                    <div className="acv2-body">
                      <div className="acv2-top">
                        <span className={`acv2-badge ${z.status}`}>
                          {z.status === "critical" && <span className="acv2-pulse-dot" />}
                          {STATUS_LABEL[z.status]}
                        </span>
                        <span className="acv2-zone-name">{z.label}</span>
                      </div>

                      <p className="acv2-desc">{z.alertDesc}</p>

                      <div className="acv2-meta">
                        <span><Icon name="user" size={11} strokeWidth={2} /> {z.responsible}</span>
                      </div>

                      <div className="acv2-progress-wrap">
                        <div className="acv2-progress-track">
                          <div
                            className="acv2-progress-bar"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: z.status === "critical" ? "var(--red)" : "var(--orange)",
                            }}
                          />
                        </div>
                        <span className="acv2-progress-label">
                          Point critique : {z.worstUfc} / {z.worstSeuil} UFC/cm² ({pct}%)
                        </span>
                      </div>
                    </div>

                    <div className="acv2-right">
                      <div className={`acv2-ufc ${z.status}`}>{z.worstUfc}</div>
                      <div className="acv2-ufc-unit">UFC/cm²</div>
                      <button className={`acv2-action ${z.status}`}>
                        <Icon
                          name={z.status === "critical" ? "alert" : "trend"}
                          size={12}
                          strokeWidth={2.5}
                        />
                        {z.status === "critical" ? "Intervenir" : "Surveiller"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
