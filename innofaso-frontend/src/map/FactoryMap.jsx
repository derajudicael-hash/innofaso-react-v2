'use client';

import React, { useRef, useState, useCallback } from 'react';
import { ZONES, isRandomPointId } from './factoryData.js';
import { getZoneLevel, getPointOverallLevel, LEVEL_COLORS } from './labParser.js';

// ViewBox exactly matching the image proportions: ~1515 × 490
const VW = 1515, VH = 490;
const px = (p) => (p / 100) * VW;
const py = (p) => (p / 100) * VH;

// Gray defaults
const GRAY_ZONE_FILL   = '#e4e7eb';
const GRAY_ZONE_STROKE = '#9ca3af';
const GRAY_DOT         = '#9ca3af';

// Zone fills when data is present
const ZONE_DATA_FILL = {
  green:   '#bbf7d0',
  orange:  '#fde68a',
  red:     '#fecaca',
  absent:  '#bbf7d0',
  present: '#fecaca',
  unknown: GRAY_ZONE_FILL,
};

// Backend fallback fills
const BACKEND_FILL   = { ok: '#bbf7d0', warning: '#fde68a', critical: '#fecaca' };
const BACKEND_STROKE = { ok: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };

export default function FactoryMap({ results, backendZones = [], dynamicPoints, selectedZone, onSelectZone, onSelectPoint }) {
  const svgRef = useRef(null);
  const [vb, setVb] = useState({ x: 0, y: 0, w: VW, h: VH });
  const [hovZone, setHovZone] = useState(null);
  const [hovPt, setHovPt] = useState(null);
  const panning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const hasData = results.size > 0;

  // Backend lookup
  const backendByMapId = {};
  backendZones.forEach(bz => { if (bz.mapId) backendByMapId[bz.mapId] = bz; });

  const setView = (x, y, w, h) => setVb({ x, y, w, h });

  const zoomToZone = useCallback((zone) => {
    const pad = 60;
    setView(
      px(zone.x) - pad, py(zone.y) - pad,
      px(zone.width) + pad * 2, py(zone.height) + pad * 2
    );
  }, []);

  const reset = useCallback(() => setView(0, 0, VW, VH), []);

  function onWheel(e) {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.15 : 0.87;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * vb.w + vb.x;
    const my = ((e.clientY - rect.top) / rect.height) * vb.h + vb.y;
    const nw = Math.min(VW * 2, Math.max(100, vb.w * f));
    const nh = Math.min(VH * 2, Math.max(60, vb.h * f));
    setView(mx - (mx - vb.x) / vb.w * nw, my - (my - vb.y) / vb.h * nh, nw, nh);
  }
  function onMouseDown(e) { if (e.button === 0) { panning.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; } }
  function onMouseMove(e) {
    if (!panning.current) return;
    const rect = svgRef.current.getBoundingClientRect();
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
        ].map(({ label, onClick }) => (
          <button key={label} onClick={onClick} style={{ width: 28, height: 28, borderRadius: 4, background: '#fff', border: '1px solid #ccc', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#444', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
            {label}
          </button>
        ))}
        <button onClick={() => { onSelectZone(null); reset(); }} title="Vue d'ensemble" style={{ width: 28, height: 28, borderRadius: 4, background: '#fff', border: '1px solid #ccc', cursor: 'pointer', color: '#444', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBoxStr}
        style={{ width: '100%', height: '100%', display: 'block', cursor: panning.current ? 'grabbing' : 'grab' }}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        {/* Off-white map background */}
        <rect width={VW} height={VH} fill="#f5f5f5" />

        {/* OUTER WALLS */}
        <rect x={px(0)} y={py(4.3)} width={px(100)} height={py(73.3)} fill="none" stroke="#666" strokeWidth="2"/>
        <rect x={px(43.0)} y={py(77.6)} width={px(45.8)} height={py(22.4)} fill="none" stroke="#666" strokeWidth="2"/>

        {/* TOP ELEMENTS */}
        <rect x={px(36)} y={py(0)} width={px(16)} height={py(4.3)} fill="#f0f0f0" stroke="#999" strokeWidth="1"/>
        <text x={px(44)} y={py(1.8)} textAnchor="middle" fontSize="7" fontWeight="600" fill="#555" fontFamily="Arial,sans-serif">Compresseur Sécheur + CTA +Aspirateur</text>
        <text x={px(44)} y={py(3.4)} textAnchor="middle" fontSize="6" fill="#777" fontFamily="Arial,sans-serif">30m²</text>
        <rect x={px(52.5)} y={py(0.3)} width={px(1.8)} height={py(3.6)} fill="none" stroke="#999" strokeWidth="1"/>

        {/* RIGHT-TOP ELEMENTS */}
        {[71.5, 76.2, 80.9].map((cx, i) => (
          <g key={i}>
            <text x={px(cx)} y={py(1.8)} textAnchor="middle" fontSize="5.5" fill="#666" fontFamily="Arial,sans-serif">Cuve</text>
            <text x={px(cx)} y={py(3)} textAnchor="middle" fontSize="5.5" fill="#666" fontFamily="Arial,sans-serif">huile</text>
          </g>
        ))}
        <rect x={px(85.5)} y={py(0)} width={px(3.1)} height={py(4.3)} fill="#f0f0f0" stroke="#82b366" strokeWidth="1.5"/>
        <text x={px(87.05)} y={py(1.8)} textAnchor="middle" fontSize="6" fontWeight="700" fill="#4a7c3f" fontFamily="Arial,sans-serif">SAS</text>
        <text x={px(87.05)} y={py(3.2)} textAnchor="middle" fontSize="6" fontWeight="700" fill="#4a7c3f" fontFamily="Arial,sans-serif">MP</text>
        <rect x={px(88.6)} y={py(0)} width={px(11.4)} height={py(4.3)} fill="#f0f0f0" stroke="#82b366" strokeWidth="1.5"/>
        <text x={px(94.3)} y={py(1.6)} textAnchor="middle" fontSize="5.8" fill="#4a7c3f" fontFamily="Arial,sans-serif">Zone de</text>
        <text x={px(94.3)} y={py(2.9)} textAnchor="middle" fontSize="5.8" fill="#4a7c3f" fontFamily="Arial,sans-serif">prélèvement hôte</text>

        {/* SAS S+A+H */}
        <rect x={px(83.8)} y={py(10.2)} width={px(4.8)} height={py(32)} fill="#daeeff" stroke="#5aabcc" strokeWidth="1"/>
        <text x={px(86.2)} y={py(23)} textAnchor="middle" fontSize="6" fill="#1a6682" fontFamily="Arial,sans-serif"
          transform={`rotate(-90,${px(86.2)},${py(23)})`}>SAS S+A+H  10m²</text>

        {/* TOILETTES F */}
        <rect x={px(83.8)} y={py(42.2)} width={px(4.8)} height={py(35.4)} fill="#f8d7da" stroke="#cc3333" strokeWidth="1"/>
        <text x={px(86.2)} y={py(58)} textAnchor="middle" fontSize="7" fontWeight="600" fill="#9a1111" fontFamily="Arial,sans-serif">Toilettes F</text>
        <text x={px(86.2)} y={py(61)} textAnchor="middle" fontSize="5.5" fill="#9a1111" fontFamily="Arial,sans-serif">13m²</text>
        <ellipse cx={px(85.3)} cy={py(70)} rx={px(1.2)} ry={py(3.5)} fill="white" stroke="#cc5555" strokeWidth="0.8"/>
        <ellipse cx={px(87.5)} cy={py(70)} rx={px(1.2)} ry={py(3.5)} fill="white" stroke="#cc5555" strokeWidth="0.8"/>

        {/* ENTRÉE / SORTIE LAVERIE */}
        <text x={px(38)} y={py(76.5)} fontSize="6" fill="#555" fontFamily="Arial,sans-serif">Entrée Laverie</text>
        <text x={px(38)} y={py(78.5)} fontSize="6" fill="#555" fontFamily="Arial,sans-serif">Sortie Laverie</text>

        {/* STAIRCASE */}
        {[0,1,2,3].map(i => (
          <rect key={i} x={px(86.8 + i * 0.25)} y={py(69 - i * 2)} width={px(0.9)} height={py(8 + i * 2)} fill="none" stroke="#aaa" strokeWidth="0.5"/>
        ))}

        {/* ZONES */}
        {ZONES.map(zone => {
          const zx = px(zone.x), zy = py(zone.y), zw = px(zone.width), zh = py(zone.height);
          const zonePts = dynamicPoints?.[zone.id] ?? [];
          const zonePointIds = zonePts.map(p => p.id);
          const level = getZoneLevel(results, zonePointIds);
          const isSelected = selectedZone?.id === zone.id;
          const isHov = hovZone === zone.id;
          const bz = backendByMapId[zone.id];

          // Logique de couleur : bulletin importé > backend > gris
          const hasUploadedForZone = zonePointIds.some(id => results.has(id));
          let fill, stroke;
          if (hasUploadedForZone && level !== 'unknown') {
            fill   = ZONE_DATA_FILL[level];
            stroke = isSelected ? '#5c5852' : LEVEL_COLORS[level];
          } else if (bz && bz.hasData !== false) {
            fill   = BACKEND_FILL[bz.status];
            stroke = isSelected ? '#5c5852' : BACKEND_STROKE[bz.status];
          } else {
            fill   = GRAY_ZONE_FILL;
            stroke = isSelected ? '#5c5852' : GRAY_ZONE_STROKE;
          }
          const strokeW = isSelected ? 3 : isHov ? 2.5 : 1.5;

          return (
            <g key={zone.id}>
              <rect
                x={zx} y={zy} width={zw} height={zh}
                fill={fill} stroke={stroke} strokeWidth={strokeW}
                style={{ cursor: 'pointer' }}
                onClick={() => { if (selectedZone?.id === zone.id) { onSelectZone(null); reset(); } else { onSelectZone(zone); zoomToZone(zone); } }}
                onMouseEnter={() => setHovZone(zone.id)}
                onMouseLeave={() => setHovZone(null)}
              />

              {/* Zone name */}
              <text x={zx + zw / 2} y={zy + 13} textAnchor="middle" fontSize="9" fontWeight="700"
                fill="#1a3a5c" fontFamily="Arial,sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {zone.name}
              </text>
              {zone.area && (
                <text x={zx + zw / 2} y={zy + 22} textAnchor="middle" fontSize="7" fill="#1a3a5c" opacity="0.8"
                  fontFamily="Arial,sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {zone.area}
                </text>
              )}

              {/* UFC depuis le backend */}
              {bz && !hasUploadedForZone && zw >= 80 && zh >= 50 && (
                <text x={zx + zw / 2} y={zy + zh / 2 + 4} textAnchor="middle"
                  fontSize={zw < 120 ? '7' : '9'} fontWeight="700" fill="#1a3a5c"
                  fontFamily="Arial,sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {bz.ufc} UFC/cm²
                </text>
              )}

              {/* Data badge top-right */}
              {(hasUploadedForZone && level !== 'unknown') && (
                <circle cx={zx + zw - 7} cy={zy + 7} r={4.5}
                  fill={LEVEL_COLORS[level]} stroke="white" strokeWidth="1.2"
                  style={{ pointerEvents: 'none' }}/>
              )}
              {bz && bz.hasData !== false && !hasUploadedForZone && (
                <circle cx={zx + zw - 7} cy={zy + 7} r={4.5}
                  fill={BACKEND_STROKE[bz.status]} stroke="white" strokeWidth="1.2"
                  style={{ pointerEvents: 'none' }}/>
              )}

              {/* Points de prélèvement — un par point connu du système (créé par
                  import de bulletin ou ajout manuel), placés aléatoirement dans
                  leur zone (cf. computeNewPointPosition côté serveur) puisque le
                  bulletin ne donne jamais de position physique réelle. */}
              {zonePts.map(pt => {
                const ptResults = results.get(pt.id) ?? [];
                const ptLevel = ptResults.length > 0 ? getPointOverallLevel(ptResults) : 'unknown';
                const dotColor = ptResults.length > 0 ? LEVEL_COLORS[ptLevel] : GRAY_DOT;
                const ptx = px(pt.x), pty = py(pt.y);
                const isHovP = hovPt === pt.id;
                const r = isHovP ? 6.5 : 4.5;

                return (
                  <g key={pt.id} style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); onSelectPoint?.(pt, zone); }}
                    onMouseEnter={() => setHovPt(pt.id)}
                    onMouseLeave={() => setHovPt(null)}>
                    <circle cx={ptx} cy={pty} r={r} fill={dotColor} stroke="white" strokeWidth="1.2"/>
                    {isHovP && (() => {
                      const hasUfc = pt.ufc !== null && pt.ufc !== undefined;
                      const ufcTxt    = hasUfc ? `${pt.ufc} UFC/cm²` : null;
                      const descTxt   = pt.description || null;
                      const randomTxt = isRandomPointId(pt.id) ? 'Aléatoire' : 'Point fixe';
                      const extraLines = [ufcTxt, descTxt, randomTxt].filter(Boolean);
                      const w = Math.max(
                        pt.label.length * 6.2 + 8,
                        ...extraLines.map(t => t.length * 5.4 + 8)
                      );
                      const h = 14 + extraLines.length * 12;
                      return (
                        <g>
                          <rect x={ptx + 7} y={pty - 9} width={w} height={h}
                            fill="rgba(0,0,0,0.82)" rx="3"/>
                          <text x={ptx + 11} y={pty + 1.5} fontSize="8.5" fill="white"
                            fontWeight="700" fontFamily="Arial,sans-serif" style={{ pointerEvents: 'none' }}>
                            {pt.label}
                          </text>
                          {extraLines.map((txt, i) => (
                            <text key={i} x={ptx + 11} y={pty + 13 + i * 11} fontSize="7.5"
                              fill={txt === randomTxt ? '#60a5fa' : txt === descTxt ? '#cbd5e1' : '#fbbf24'}
                              fontFamily="Arial,sans-serif" style={{ pointerEvents: 'none' }}>
                              {txt}
                            </text>
                          ))}
                        </g>
                      );
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* BOTTOM LABELS */}
        <text x={px(50)} y={py(96)} textAnchor="middle" fontSize="9" fill="#555" fontFamily="Arial,sans-serif">Entree vestiaire</text>
        <text x={px(1.5)} y={py(87)} fontSize="6" fill="#888" fontFamily="Arial,sans-serif"
          transform={`rotate(-90,${px(1.5)},${py(87)})`}>chargement produits finis</text>
        <text x={px(98.5)} y={py(89)} fontSize="6" fill="#888" fontFamily="Arial,sans-serif"
          transform={`rotate(90,${px(98.5)},${py(89)})`}>déchargement matières premières</text>
      </svg>
    </div>
  );
}
