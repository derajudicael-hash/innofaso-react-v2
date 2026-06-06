import React, { useRef, useState, useCallback } from 'react';
import { ZONES, Zone, SamplingPoint } from './factoryData';
import { LabResult, ResultLevel, getPointOverallLevel, getZoneLevel, LEVEL_COLORS } from './labParser';

export interface BackendZone {
  id: string;
  mapId: string;
  label: string;
  status: 'ok' | 'warning' | 'critical';
  ufc: number;
  seuil: number;
}

interface Props {
  results: Map<string, LabResult[]>;
  backendZones?: BackendZone[];
  selectedZone: Zone | null;
  onSelectZone: (z: Zone | null) => void;
  onSelectPoint: (p: SamplingPoint, z: Zone) => void;
}

const VW = 1515, VH = 490;
const px = (p: number) => (p / 100) * VW;
const py = (p: number) => (p / 100) * VH;

const GRAY_ZONE_FILL   = '#e4e7eb';
const GRAY_ZONE_STROKE = '#9ca3af';
const GRAY_DOT         = '#9ca3af';

const ZONE_DATA_FILL: Record<ResultLevel, string> = {
  green:   '#bbf7d0',
  orange:  '#fde68a',
  red:     '#fecaca',
  absent:  '#bbf7d0',
  present: '#fecaca',
  unknown: GRAY_ZONE_FILL,
};

const BACKEND_FILL = { ok: '#bbf7d0', warning: '#fde68a', critical: '#fecaca' };
const BACKEND_STROKE = { ok: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };

export default function FactoryMap({ results, backendZones = [], selectedZone, onSelectZone, onSelectPoint }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState({ x: 0, y: 0, w: VW, h: VH });
  const [hovZone, setHovZone] = useState<string | null>(null);
  const [hovPt, setHovPt]   = useState<string | null>(null);
  const panning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const byMapId: Record<string, BackendZone> = {};
  backendZones.forEach(z => { if (z.mapId) byMapId[z.mapId] = z; });

  const setView = (x: number, y: number, w: number, h: number) => setVb({ x, y, w, h });
  const reset = useCallback(() => setView(0, 0, VW, VH), []);

  const zoomToZone = useCallback((zone: Zone) => {
    const pad = 60;
    setView(px(zone.x) - pad, py(zone.y) - pad, px(zone.width) + pad * 2, py(zone.height) + pad * 2);
  }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.15 : 0.87;
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * vb.w + vb.x;
    const my = ((e.clientY - rect.top) / rect.height) * vb.h + vb.y;
    const nw = Math.min(VW * 2, Math.max(100, vb.w * f));
    const nh = Math.min(VH * 2, Math.max(60, vb.h * f));
    setView(mx - (mx - vb.x) / vb.w * nw, my - (my - vb.y) / vb.h * nh, nw, nh);
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button === 0) { panning.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!panning.current) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - lastMouse.current.x) / rect.width) * vb.w;
    const dy = ((e.clientY - lastMouse.current.y) / rect.height) * vb.h;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setVb(v => ({ ...v, x: v.x - dx, y: v.y - dy }));
  }
  function onMouseUp() { panning.current = false; }

  const viewBoxStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#f5f5f5' }}>
      {/* Zoom controls */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[
          { label: '+', onClick: () => { const nw = Math.max(100, vb.w * 0.75); const nh = Math.max(60, vb.h * 0.75); setView(vb.x + (vb.w - nw) / 2, vb.y + (vb.h - nh) / 2, nw, nh); } },
          { label: '−', onClick: () => { const nw = Math.min(VW * 2, vb.w * 1.33); const nh = Math.min(VH * 2, vb.h * 1.33); setView(vb.x - (nw - vb.w) / 2, vb.y - (nh - vb.h) / 2, nw, nh); } },
          { label: '⌂', onClick: () => { onSelectZone(null); reset(); } },
        ].map(({ label, onClick }) => (
          <button key={label} onClick={onClick} style={{ width: 28, height: 28, borderRadius: 4, background: '#fff', border: '1px solid #ccc', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#444', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
            {label}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBoxStr}
        style={{ width: '100%', height: '100%', display: 'block', cursor: panning.current ? 'grabbing' : 'grab' }}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        <rect width={VW} height={VH} fill="#f5f5f5" />

        {/* Outer walls */}
        <rect x={px(0)} y={py(4.3)} width={px(100)} height={py(73.3)} fill="none" stroke="#666" strokeWidth="2"/>
        <rect x={px(43.0)} y={py(77.6)} width={px(45.8)} height={py(22.4)} fill="none" stroke="#666" strokeWidth="2"/>

        {/* Top elements */}
        <rect x={px(36)} y={py(0)} width={px(16)} height={py(4.3)} fill="#f0f0f0" stroke="#999" strokeWidth="1"/>
        <text x={px(44)} y={py(1.8)} textAnchor="middle" fontSize="7" fontWeight="600" fill="#555" fontFamily="Arial,sans-serif">Compresseur Sécheur + CTA + Aspirateur</text>
        <text x={px(44)} y={py(3.4)} textAnchor="middle" fontSize="6" fill="#777" fontFamily="Arial,sans-serif">30m²</text>

        {/* Cuve huile circles */}
        {[71.5, 76.2, 80.9].map((cx, i) => (
          <g key={i}>
            <circle cx={px(cx)} cy={py(2.2)} r={px(1.8)} fill="white" stroke="#999" strokeWidth="1"/>
            <text x={px(cx)} y={py(1.8)} textAnchor="middle" fontSize="5.5" fill="#666" fontFamily="Arial,sans-serif">Cuve</text>
            <text x={px(cx)} y={py(3)} textAnchor="middle" fontSize="5.5" fill="#666" fontFamily="Arial,sans-serif">huile</text>
          </g>
        ))}

        {/* SAS MP */}
        <rect x={px(85.5)} y={py(0)} width={px(3.1)} height={py(4.3)} fill="#f0f0f0" stroke="#82b366" strokeWidth="1.5"/>
        <text x={px(87.05)} y={py(1.8)} textAnchor="middle" fontSize="6" fontWeight="700" fill="#4a7c3f" fontFamily="Arial,sans-serif">SAS</text>
        <text x={px(87.05)} y={py(3.2)} textAnchor="middle" fontSize="6" fontWeight="700" fill="#4a7c3f" fontFamily="Arial,sans-serif">MP</text>
        <rect x={px(88.6)} y={py(0)} width={px(11.4)} height={py(4.3)} fill="#f0f0f0" stroke="#82b366" strokeWidth="1.5"/>
        <text x={px(94.3)} y={py(2.2)} textAnchor="middle" fontSize="5.8" fill="#4a7c3f" fontFamily="Arial,sans-serif">Zone de prélèvement hôte</text>

        {/* SAS S+A+H */}
        <rect x={px(83.8)} y={py(10.2)} width={px(4.8)} height={py(32)} fill="#daeeff" stroke="#5aabcc" strokeWidth="1"/>
        <text x={px(86.2)} y={py(23)} textAnchor="middle" fontSize="6" fill="#1a6682" fontFamily="Arial,sans-serif" transform={`rotate(-90,${px(86.2)},${py(23)})`}>SAS S+A+H  10m²</text>

        {/* Toilettes F */}
        <rect x={px(83.8)} y={py(42.2)} width={px(4.8)} height={py(35.4)} fill="#f8d7da" stroke="#cc3333" strokeWidth="1"/>
        <text x={px(86.2)} y={py(58)} textAnchor="middle" fontSize="7" fontWeight="600" fill="#9a1111" fontFamily="Arial,sans-serif">Toilettes F</text>
        <text x={px(86.2)} y={py(61)} textAnchor="middle" fontSize="5.5" fill="#9a1111" fontFamily="Arial,sans-serif">13m²</text>

        {/* Entrée / Sortie Laverie */}
        <text x={px(38)} y={py(76.5)} fontSize="6" fill="#555" fontFamily="Arial,sans-serif">Entrée Laverie</text>
        <text x={px(38)} y={py(78.5)} fontSize="6" fill="#555" fontFamily="Arial,sans-serif">Sortie Laverie</text>

        {/* Zones */}
        {ZONES.map(zone => {
          const zx = px(zone.x), zy = py(zone.y), zw = px(zone.width), zh = py(zone.height);
          const zonePointIds = zone.points.map(p => p.id);
          const isSelected = selectedZone?.id === zone.id;
          const isHov = hovZone === zone.id;
          const bz = byMapId[zone.id];

          // Color priority: uploaded file > backend data > grey
          const hasUploadedData = zonePointIds.some(id => results.has(id));
          let fill = GRAY_ZONE_FILL;
          let strokeColor = isSelected ? '#0066cc' : GRAY_ZONE_STROKE;

          if (hasUploadedData) {
            const level = getZoneLevel(results, zonePointIds);
            fill = ZONE_DATA_FILL[level];
            if (!isSelected) strokeColor = level !== 'unknown' ? LEVEL_COLORS[level] : GRAY_ZONE_STROKE;
          } else if (bz) {
            fill = BACKEND_FILL[bz.status];
            if (!isSelected) strokeColor = BACKEND_STROKE[bz.status];
          }

          const strokeW = isSelected ? 3 : isHov ? 2.5 : 1.5;

          return (
            <g key={zone.id}>
              <rect
                x={zx} y={zy} width={zw} height={zh}
                fill={fill} stroke={strokeColor} strokeWidth={strokeW}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (selectedZone?.id === zone.id) { onSelectZone(null); reset(); }
                  else { onSelectZone(zone); zoomToZone(zone); }
                }}
                onMouseEnter={() => setHovZone(zone.id)}
                onMouseLeave={() => setHovZone(null)}
              />
              <text x={zx + zw / 2} y={zy + 13} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a3a5c" fontFamily="Arial,sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {zone.name}
              </text>
              {zone.area && (
                <text x={zx + zw / 2} y={zy + 22} textAnchor="middle" fontSize="7" fill="#1a3a5c" opacity="0.8" fontFamily="Arial,sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {zone.area}
                </text>
              )}
              {/* UFC badge from backend */}
              {bz && !hasUploadedData && (
                <text x={zx + zw / 2} y={zy + zh / 2 + 4} textAnchor="middle" fontSize={zw < 100 ? '7' : '9'} fontWeight="700" fill="#1a3a5c" fontFamily="Arial,sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {bz.ufc} UFC/cm²
                </text>
              )}
              {/* Data badge top-right */}
              {(hasUploadedData || bz) && (
                <circle cx={zx + zw - 7} cy={zy + 7} r={4.5}
                  fill={hasUploadedData ? LEVEL_COLORS[getZoneLevel(results, zonePointIds)] : BACKEND_STROKE[bz!.status]}
                  stroke="white" strokeWidth="1.2" style={{ pointerEvents: 'none' }}/>
              )}
              {/* Sampling points */}
              {zone.points.map(pt => {
                const ptResults = results.get(pt.id) ?? [];
                const ptLevel = ptResults.length > 0 ? getPointOverallLevel(ptResults) : 'unknown';
                const dotColor = ptResults.length > 0 ? LEVEL_COLORS[ptLevel] : GRAY_DOT;
                const ptx = px(pt.x), pty = py(pt.y);
                const isHovP = hovPt === pt.id;
                const r = isHovP ? 6.5 : 4.5;
                return (
                  <g key={pt.id} style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); onSelectPoint(pt, zone); }}
                    onMouseEnter={() => setHovPt(pt.id)}
                    onMouseLeave={() => setHovPt(null)}>
                    <circle cx={ptx} cy={pty} r={r} fill={dotColor} stroke="white" strokeWidth="1.2"/>
                    {isHovP && (
                      <g>
                        <rect x={ptx + 7} y={pty - 9} width={pt.label.length * 6.2 + 8} height={14} fill="rgba(0,0,0,0.75)" rx="3"/>
                        <text x={ptx + 11} y={pty + 1.5} fontSize="8.5" fill="white" fontWeight="700" fontFamily="Arial,sans-serif" style={{ pointerEvents: 'none' }}>
                          {pt.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Bottom labels */}
        <text x={px(50)} y={py(96)} textAnchor="middle" fontSize="9" fill="#555" fontFamily="Arial,sans-serif">← Entrée vestiaire →</text>
        <text x={px(1.5)} y={py(87)} fontSize="6" fill="#888" fontFamily="Arial,sans-serif" transform={`rotate(-90,${px(1.5)},${py(87)})`}>chargement produits finis</text>
        <text x={px(98.5)} y={py(89)} fontSize="6" fill="#888" fontFamily="Arial,sans-serif" transform={`rotate(90,${px(98.5)},${py(89)})`}>déchargement matières premières</text>
      </svg>
    </div>
  );
}
