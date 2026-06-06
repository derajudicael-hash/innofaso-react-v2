import { useState } from "react";
import { useAdminData } from "../context/AdminDataContext";
import { SVG_ZONES, SAMPLING_POINTS, ENV_LABELS, ENV_BADGE_STYLE } from "../data/mapZones";

const COLORS = {
  green:  { fill: "#eaf6f0", stroke: "#1a7a4a", text: "#135536" },
  orange: { fill: "#fef5ec", stroke: "#c75c16", text: "#7a3610" },
  red:    { fill: "#fdf1f0", stroke: "#bf3b2e", text: "#7d2519" },
  none:   { fill: "#f0f3f6", stroke: "#bfccd6", text: "#8ca0b2" },
};
const STATUS_COLOR = { ok: "green", warning: "orange", critical: "red" };

const MINI_SCALE = 0.22;

function ptPos(zone, index, total) {
  const cols = Math.min(total, 2);
  return {
    cx: zone.x + zone.w * 0.3 + (index % cols) * (zone.w * 0.35),
    cy: zone.y + zone.h * 0.62 + Math.floor(index / cols) * 16,
  };
}

function MiniMap({ selectedMapId, byMapId }) {
  const vw = (1050 * MINI_SCALE).toFixed(0);
  const vh = (510 * MINI_SCALE).toFixed(0);
  return (
    <div className="carto-minimap">
      <p className="carto-minimap-label">Localisation</p>
      <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" xmlns="http://www.w3.org/2000/svg">
        {SVG_ZONES.map((z) => {
          const dbZone   = byMapId[z.id];
          const colorKey = dbZone ? (STATUS_COLOR[dbZone.status] || "green") : "none";
          const pal      = COLORS[colorKey];
          const isSel    = z.id === selectedMapId;
          return (
            <rect
              key={z.id}
              x={z.x * MINI_SCALE} y={z.y * MINI_SCALE}
              width={z.w * MINI_SCALE} height={z.h * MINI_SCALE}
              fill={isSel ? pal.fill : pal.fill + "99"}
              stroke={isSel ? pal.text : "#ccc"}
              strokeWidth={isSel ? 2 : 0.5}
              rx={2}
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function CartoPage() {
  const { zones, loading, error } = useAdminData();
  const [selectedMapId, setSelectedMapId] = useState(null);

  if (loading) return <div className="dash-loading">Chargement de la carte...</div>;
  if (error)   return <div className="dash-error">Impossible de charger les données.</div>;

  // Build mapId → DB zone lookup
  const byMapId = {};
  zones.forEach((z) => { if (z.mapId) byMapId[z.mapId] = z; });

  const selectedSvgZone = SVG_ZONES.find((z) => z.id === selectedMapId);
  const selectedDbZone  = selectedMapId ? byMapId[selectedMapId] : null;
  const headerPal       = selectedDbZone
    ? COLORS[STATUS_COLOR[selectedDbZone.status] || "green"]
    : null;

  return (
    <div className="carto-layout">
      {/* SVG Map */}
      <div className="carto-map-area panel">
        <div className="panel-header">Cartographie détaillée — {SVG_ZONES.length} zones · {Object.keys(SAMPLING_POINTS).length} points de prélèvement</div>
        <div className="carto-svg-wrap">
          <svg
            viewBox="0 0 1050 510"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
            className="carto-svg"
          >
            {SVG_ZONES.map((z) => {
              const dbZone   = byMapId[z.id];
              const colorKey = dbZone ? (STATUS_COLOR[dbZone.status] || "green") : "none";
              const pal      = COLORS[colorKey];
              const isSel    = selectedMapId === z.id;

              return (
                <g
                  key={z.id}
                  onClick={() => setSelectedMapId(isSel ? null : z.id)}
                  style={{
                    cursor:  "pointer",
                    opacity: selectedMapId && !isSel ? 0.55 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  <rect
                    x={z.x} y={z.y} width={z.w} height={z.h}
                    fill={pal.fill}
                    stroke={isSel ? pal.text : pal.stroke}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    rx={4}
                  />
                  <text
                    x={z.x + z.w / 2} y={z.y + z.h * 0.22}
                    textAnchor="middle" fontSize={z.w < 60 ? 6 : 9}
                    fontWeight={600} fill={pal.text}
                    style={{ pointerEvents: "none" }}
                  >
                    {z.label}
                  </text>
                  {z.sub && z.w >= 80 && (
                    <text
                      x={z.x + z.w / 2} y={z.y + z.h * 0.22 + 10}
                      textAnchor="middle" fontSize={6} fill={pal.stroke}
                      style={{ pointerEvents: "none" }}
                    >
                      {z.sub}
                    </text>
                  )}
                  {dbZone && z.w >= 60 && z.h >= 50 && (
                    <text
                      x={z.x + z.w / 2} y={z.y + z.h * 0.58}
                      textAnchor="middle" fontSize={z.w < 100 ? 7 : 9}
                      fontWeight={700} fill={pal.text}
                      style={{ pointerEvents: "none" }}
                    >
                      {dbZone.ufc} UFC/cm²
                    </text>
                  )}
                  {z.pointIds.map((ptId, i) => {
                    const pos = ptPos(z, i, z.pointIds.length);
                    return (
                      <circle key={ptId} cx={pos.cx} cy={pos.cy} r={3.5}
                        fill="#E24B4A" style={{ pointerEvents: "none" }} />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="map-legend" style={{ padding: "8px 18px 14px" }}>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#7abf62" }} />Conforme</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#e8a430" }} />Surveillance</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#e06050" }} />Critique</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#E24B4A" }} />Pt. prélèvement</div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="carto-sidebar panel">
        {!selectedSvgZone ? (
          <div className="carto-sidebar-empty">
            <p>Cliquez sur une zone pour afficher ses détails et points de prélèvement.</p>
          </div>
        ) : (
          <div className="carto-sidebar-content">
            {/* Header zone */}
            <div className="carto-zone-header" style={{ borderColor: headerPal?.stroke }}>
              <div
                className="carto-zone-badge"
                style={{ background: headerPal?.fill, border: `1.5px solid ${headerPal?.stroke}`, color: headerPal?.text }}
              >
                {selectedSvgZone.num}
              </div>
              <div>
                <p className="carto-zone-name">{selectedSvgZone.label}</p>
                <p className="carto-zone-sub">{selectedSvgZone.sub || "—"} · {selectedSvgZone.pointIds.length} point(s)</p>
              </div>
            </div>

            {/* Métriques DB */}
            {selectedDbZone && (
              <div className="carto-metrics">
                <div className="carto-metric">
                  <span className="carto-metric-label">UFC/cm²</span>
                  <span className="carto-metric-val" style={{ color: headerPal?.text }}>{selectedDbZone.ufc}</span>
                </div>
                <div className="carto-metric">
                  <span className="carto-metric-label">Seuil</span>
                  <span className="carto-metric-val">{selectedDbZone.seuil}</span>
                </div>
                <div className="carto-metric">
                  <span className="carto-metric-label">Statut</span>
                  <span className="carto-metric-val" style={{ color: headerPal?.text, fontSize: 11 }}>
                    {selectedDbZone.alertTitle}
                  </span>
                </div>
                <div className="carto-metric" style={{ gridColumn: "span 2" }}>
                  <span className="carto-metric-label">Responsable</span>
                  <span className="carto-metric-val" style={{ fontSize: 11 }}>{selectedDbZone.responsible}</span>
                </div>
              </div>
            )}

            <MiniMap selectedMapId={selectedMapId} byMapId={byMapId} />

            {/* Points de prélèvement */}
            <p className="carto-pts-title">Points de prélèvement</p>
            {selectedSvgZone.pointIds.length === 0 ? (
              <p className="carto-pts-empty">Aucun point défini pour cette zone.</p>
            ) : (
              selectedSvgZone.pointIds.map((ptId) => {
                const pt = SAMPLING_POINTS[ptId];
                if (!pt) return null;
                return (
                  <div key={ptId} className="carto-pt-card">
                    <p className="carto-pt-id">{ptId}</p>
                    <p className="carto-pt-name">{pt.name}</p>
                    <span className="carto-pt-env" style={ENV_BADGE_STYLE[pt.env]}>
                      {ENV_LABELS[pt.env]}
                    </span>
                    <div className="carto-pt-thresholds">
                      <span style={{ background: "#eff6ff", color: "#1e40af" }}>Entéro : {pt.entero}</span>
                      <span style={{ background: "#f0fdf4", color: "#166534" }}>Salmo : {pt.salmo}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
