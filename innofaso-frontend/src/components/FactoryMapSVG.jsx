import { useRef, useState, useCallback, useMemo } from "react";
import { ZONES } from "../map/factoryData";

const VW = 1515, VH = 490;
const px = (p) => (p / 100) * VW;
const py = (p) => (p / 100) * VH;
const VB_FULL = `0 0 ${VW} ${VH}`;
const PAD = 60;

const COLORS = {
  ok:       { fill: "#bbf7d0", stroke: "#22c55e", text: "#15803d" },
  warning:  { fill: "#fde68a", stroke: "#f59e0b", text: "#92400e" },
  critical: { fill: "#fecaca", stroke: "#ef4444", text: "#991b1b" },
  none:     { fill: "#e4e7eb", stroke: "#9ca3af", text: "#4b5563" },
};

function animateViewBox(svgEl, from, to, dur = 320, onDone) {
  const parse = (s) => s.split(" ").map(Number);
  const [x0, y0, w0, h0] = parse(from);
  const [x1, y1, w1, h1] = parse(to);
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const e = p < 0.5 ? 2 * p * p : (4 - 2 * p) * p - 1;
    svgEl.setAttribute("viewBox", `${x0+(x1-x0)*e} ${y0+(y1-y0)*e} ${w0+(w1-w0)*e} ${h0+(h1-h0)*e}`);
    if (p < 1) requestAnimationFrame(step);
    else onDone?.(to);
  }
  requestAnimationFrame(step);
}

export default function FactoryMapSVG({ zones, selectedId, onSelect }) {
  const svgRef  = useRef(null);
  const [viewBox, setViewBox] = useState(VB_FULL);

  const byMapId = useMemo(() => {
    const m = {};
    (zones || []).forEach(z => { if (z.mapId) m[z.mapId] = z; });
    return m;
  }, [zones]);

  const selectedDbZone = (zones || []).find(z => z.id === selectedId);
  const selectedMapId  = selectedDbZone?.mapId ?? null;

  const handleClick = useCallback((svgZone) => {
    const dbZone = byMapId[svgZone.id];
    if (!svgRef.current) return;
    const cur = svgRef.current.getAttribute("viewBox") || VB_FULL;
    const zx = px(svgZone.x), zy = py(svgZone.y), zw = px(svgZone.width), zh = py(svgZone.height);
    const target = `${zx - PAD} ${zy - PAD} ${zw + PAD * 2} ${zh + PAD * 2}`;
    animateViewBox(svgRef.current, cur, target, 320, setViewBox);
    if (dbZone) onSelect(dbZone.id);
  }, [byMapId, onSelect]);

  const handleReset = useCallback(() => {
    if (!svgRef.current) return;
    const cur = svgRef.current.getAttribute("viewBox") || VB_FULL;
    animateViewBox(svgRef.current, cur, VB_FULL, 320, setViewBox);
    onSelect(null);
  }, [onSelect]);

  return (
    <div className="panel map-panel">
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Cartographie de l'usine</span>
        {selectedMapId && (
          <button onClick={handleReset} style={{ fontSize: 11, color: "#1a6fa3", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Vue globale
          </button>
        )}
      </div>
      <div className="map-svg-body">
        <svg ref={svgRef} viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" className="map-svg">

          {/* Outer walls */}
          <rect x={px(0)} y={py(4.3)} width={px(100)} height={py(73.3)} fill="none" stroke="#bbb" strokeWidth="2"/>
          <rect x={px(43)} y={py(77.6)} width={px(45.8)} height={py(22.4)} fill="none" stroke="#bbb" strokeWidth="2"/>

          {/* Top elements */}
          <rect x={px(36)} y={py(0)} width={px(16)} height={py(4.3)} fill="#f0f0f0" stroke="#ccc" strokeWidth="1"/>
          <text x={px(44)} y={py(2.5)} textAnchor="middle" fontSize="6" fill="#888" fontFamily="Arial,sans-serif">Compresseur / CTA</text>

          {/* Cuve huile */}
          {[71.5, 76.2, 80.9].map((cx, i) => (
            <circle key={i} cx={px(cx)} cy={py(2.2)} r={px(1.8)} fill="white" stroke="#ccc" strokeWidth="1"/>
          ))}

          {/* SAS MP */}
          <rect x={px(85.5)} y={py(0)} width={px(3.1)} height={py(4.3)} fill="#f0f4f0" stroke="#82b366" strokeWidth="1.5"/>
          <rect x={px(88.6)} y={py(0)} width={px(11.4)} height={py(4.3)} fill="#f0f4f0" stroke="#82b366" strokeWidth="1.5"/>

          {/* SAS S+A+H */}
          <rect x={px(83.8)} y={py(10.2)} width={px(4.8)} height={py(32)} fill="#daeeff" stroke="#5aabcc" strokeWidth="1"/>

          {/* Toilettes F */}
          <rect x={px(83.8)} y={py(42.2)} width={px(4.8)} height={py(35.4)} fill="#f8d7da" stroke="#cc3333" strokeWidth="1"/>

          {/* Zones */}
          {ZONES.map(zone => {
            const zx = px(zone.x), zy = py(zone.y), zw = px(zone.width), zh = py(zone.height);
            const dbZone = byMapId[zone.id];
            const pal    = dbZone ? COLORS[dbZone.status] : COLORS.none;
            const isSel  = selectedMapId === zone.id;
            const isCrit = dbZone?.status === "critical";

            return (
              <g key={zone.id} onClick={() => handleClick(zone)}
                style={{ cursor: "pointer", opacity: selectedMapId && !isSel ? 0.6 : 1, transition: "opacity 0.2s" }}>
                <rect x={zx} y={zy} width={zw} height={zh}
                  fill={pal.fill} stroke={isSel ? pal.text : pal.stroke} strokeWidth={isSel ? 2.5 : 1.5} rx={3}/>
                {isCrit && (
                  <rect x={zx+2} y={zy+2} width={zw-4} height={zh-4} fill="none"
                    stroke={pal.stroke} strokeWidth={1} rx={2} className="svg-pulse-ring"/>
                )}
                <text x={zx+zw/2} y={zy+12} textAnchor="middle" fontSize={Math.min(9, zw/8)} fontWeight="700"
                  fill={pal.text} fontFamily="Arial,sans-serif" style={{ pointerEvents: "none" }}>
                  {zone.name}
                </text>
                {zone.area && zw > 80 && (
                  <text x={zx+zw/2} y={zy+22} textAnchor="middle" fontSize="6"
                    fill={pal.stroke} fontFamily="Arial,sans-serif" style={{ pointerEvents: "none" }}>
                    {zone.area}
                  </text>
                )}
                {dbZone && zw >= 80 && zh >= 50 && (
                  <text x={zx+zw/2} y={zy+zh/2+4} textAnchor="middle" fontSize={zw < 120 ? "7" : "9"}
                    fontWeight="700" fill={pal.text} fontFamily="Arial,sans-serif" style={{ pointerEvents: "none" }}>
                    {dbZone.ufc} UFC/cm²
                  </text>
                )}
                {zone.points.map((pt, i) => {
                  const ptx = px(pt.x), pty = py(pt.y);
                  return <circle key={pt.id} cx={ptx} cy={pty} r={3.5} fill="#E24B4A" style={{ pointerEvents: "none" }}/>;
                })}
              </g>
            );
          })}
        </svg>

        <div className="map-legend">
          <div className="legend-item"><span className="legend-dot" style={{ background: "#22c55e" }}/>Conforme</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#f59e0b" }}/>Surveillance</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#ef4444" }}/>Critique</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#9ca3af" }}/>Sans données</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#E24B4A" }}/>Pt. prélèvement</div>
        </div>
      </div>
    </div>
  );
}
