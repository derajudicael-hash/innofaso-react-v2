import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { SVG_ZONES } from "../data/mapZones";

const COLORS = {
  green:  { fill: "#eaf6f0", stroke: "#1a7a4a", text: "#135536" },
  orange: { fill: "#fef5ec", stroke: "#c75c16", text: "#7a3610" },
  red:    { fill: "#fdf1f0", stroke: "#bf3b2e", text: "#7d2519" },
  none:   { fill: "#f0f3f6", stroke: "#bfccd6", text: "#8ca0b2" },
};

const STATUS_COLOR = { ok: "green", warning: "orange", critical: "red" };

const VB_FULL = "0 0 1050 510";
const PAD = 40;

function animateViewBox(svgEl, from, to, dur = 360, onDone) {
  const parse = (s) => s.split(" ").map(Number);
  const [x0, y0, w0, h0] = parse(from);
  const [x1, y1, w1, h1] = parse(to);
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const e = p < 0.5 ? 2 * p * p : (4 - 2 * p) * p - 1;
    const vb = `${x0 + (x1 - x0) * e} ${y0 + (y1 - y0) * e} ${w0 + (w1 - w0) * e} ${h0 + (h1 - h0) * e}`;
    svgEl.setAttribute("viewBox", vb);
    if (p < 1) requestAnimationFrame(step);
    else onDone?.(to);
  }
  requestAnimationFrame(step);
}

function ptPos(zone, index, total) {
  const cols = Math.min(total, 2);
  return {
    cx: zone.x + zone.w * 0.3 + (index % cols) * (zone.w * 0.35),
    cy: zone.y + zone.h * 0.62 + Math.floor(index / cols) * 16,
  };
}

export default function FactoryMapSVG({ zones, selectedId, onSelect }) {
  const svgRef    = useRef(null);
  const byMapIdRef = useRef({});
  const [viewBox, setViewBox] = useState(VB_FULL);

  // Mémoïser byMapId pour éviter les re-créations inutiles
  const byMapId = useMemo(() => {
    const map = {};
    (zones || []).forEach((z) => { if (z.mapId) map[z.mapId] = z; });
    return map;
  }, [zones]);

  // Garder une ref synchronisée (évite stale closure dans les callbacks)
  byMapIdRef.current = byMapId;

  // Derive which SVG zone is selected
  const selectedDbZone = (zones || []).find((z) => z.id === selectedId);
  const selectedMapId  = selectedDbZone?.mapId ?? null;

  const handleClick = useCallback((svgZone) => {
    const dbZone = byMapIdRef.current[svgZone.id];
    if (!svgRef.current) return;

    // Lire le viewBox courant depuis le DOM pour éviter la stale closure
    const currentVb = svgRef.current.getAttribute("viewBox") || VB_FULL;
    const targetVb  = `${svgZone.x - PAD} ${svgZone.y - PAD} ${svgZone.w + PAD * 2} ${svgZone.h + PAD * 2}`;
    animateViewBox(svgRef.current, currentVb, targetVb, 360, setViewBox);

    if (dbZone) onSelect(dbZone.id);
  }, [onSelect]);

  useEffect(() => {
    if (!svgRef.current || selectedId !== null) return;
    // Lire le viewBox courant depuis le DOM (évite la stale closure)
    const currentVb = svgRef.current.getAttribute("viewBox") || VB_FULL;
    animateViewBox(svgRef.current, currentVb, VB_FULL, 360, setViewBox);
  }, [selectedId]);

  return (
    <div className="panel map-panel">
      <div className="panel-header">Cartographie de l'usine</div>
      <div className="map-svg-body">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          className="map-svg"
        >
          {SVG_ZONES.map((z) => {
            const dbZone   = byMapId[z.id];
            const colorKey = dbZone ? (STATUS_COLOR[dbZone.status] || "green") : "none";
            const pal      = COLORS[colorKey];
            const isSel    = selectedMapId === z.id;
            const isCrit   = dbZone?.status === "critical";

            return (
              <g
                key={z.id}
                onClick={() => handleClick(z)}
                style={{
                  cursor:  "pointer",
                  opacity: selectedMapId && !isSel ? 0.65 : 1,
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

                {/* Pulse ring pour zones critiques */}
                {isCrit && (
                  <rect
                    x={z.x + 2} y={z.y + 2}
                    width={z.w - 4} height={z.h - 4}
                    fill="none"
                    stroke={pal.stroke}
                    strokeWidth={1}
                    rx={3}
                    className="svg-pulse-ring"
                  />
                )}

                {/* Label zone */}
                <text
                  x={z.x + z.w / 2} y={z.y + z.h * 0.22}
                  textAnchor="middle" fontSize={z.w < 60 ? 6 : 9}
                  fontWeight={600} fill={pal.text}
                  style={{ pointerEvents: "none" }}
                >
                  {z.label}
                </text>

                {/* Sous-label (si assez large) */}
                {z.sub && z.w >= 80 && (
                  <text
                    x={z.x + z.w / 2} y={z.y + z.h * 0.22 + 10}
                    textAnchor="middle" fontSize={6} fill={pal.stroke}
                    style={{ pointerEvents: "none" }}
                  >
                    {z.sub}
                  </text>
                )}

                {/* Valeur UFC (si DB zone disponible et zone assez grande) */}
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

                {/* Points de prélèvement */}
                {z.pointIds.map((ptId, i) => {
                  const pos = ptPos(z, i, z.pointIds.length);
                  return (
                    <circle
                      key={ptId}
                      cx={pos.cx} cy={pos.cy} r={3.5}
                      fill="#E24B4A"
                      style={{ pointerEvents: "none" }}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        <div className="map-legend">
          <div className="legend-item"><span className="legend-dot" style={{ background: "#7abf62" }} />Conforme</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#e8a430" }} />Surveillance</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#e06050" }} />Critique</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#d1d5db" }} />Sans données</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#E24B4A" }} />Pt. prélèvement</div>
        </div>
      </div>
    </div>
  );
}
