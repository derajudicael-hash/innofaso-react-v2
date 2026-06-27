'use client';

import React, { useState } from 'react';
import { ZONES, isRandomPointId } from './factoryData.js';
import { getLevel, getZoneLevel, getPointOverallLevel, LEVEL_COLORS, LEVEL_LABELS } from './labParser.js';

function LevelBadge({ level }) {
  const c = LEVEL_COLORS[level];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: c + '20', color: c, border: `1px solid ${c}55` }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
      {LEVEL_LABELS[level]}
    </span>
  );
}

function RandomBadge() {
  return (
    <span style={{ display: 'inline-block', marginLeft: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: '#5c5852', background: '#5c585215', border: '1px solid #5c585255', borderRadius: 999, padding: '1px 6px', verticalAlign: 'middle' }}>
      Aléatoire
    </span>
  );
}

const ZONE_TYPE_LABEL = {
  white: 'Zone Blanche — Haut Risque',
  grey: 'Zone Grise — Faible Risque',
  vestiaire: 'Zone Rouge — Vestiaires',
  laverie: 'Zone Laverie',
  external: 'Zone Périphérique',
};
// Le chiffre devant l'ID classe le point par type de surface — le seuil
// applicable n'en dépend plus : il suit désormais la zone/le bulletin
// (cf. point.seuil, affiché dans "Spécifications réglementaires" ci-dessous).
const POINT_TYPE_DESC = {
  '1': '1.x.x — Surface en contact produit',
  '2': '2.x.x — Surface à proximité',
  '3': '3.x.x — Surface support / sol / mur',
  '4': '4.x.x — Points hors zone blanche',
};

function ResultBlock({ result }) {
  const level = getLevel(result);
  const c = LEVEL_COLORS[level];
  const isSalmo    = result.parameter === 'salmonelles';
  const isCrono    = result.parameter === 'cronobacter';
  const isPresence = isSalmo || isCrono;
  return (
    <div style={{ background: c + '12', border: `1px solid ${c}44`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {isSalmo ? 'Salmonelles' : isCrono ? 'Cronobacter' : 'Entérobactéries'}
        </span>
        <LevelBadge level={level} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: c, fontFamily: 'Inter, system-ui' }}>
          {isPresence
            ? (result.detected ? 'DÉTECTÉE' : 'Absente')
            : result.numericValue !== null
              ? (result.numericValue < 1 ? '<1' : result.numericValue.toFixed(1))
              : result.rawValue || '—'
          }
        </span>
        {!isPresence && <span style={{ fontSize: 13, color: '#94a3b8' }}>UFC/cm²</span>}
        {!isPresence && result.spec && (
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>/ seuil &lt;{result.spec}</span>
        )}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 11, color: '#94a3b8' }}>
        {result.date && <span>{result.date}</span>}
        {result.method && <span>{result.method}</span>}
        {result.replicates > 1 && <span>×{result.replicates} réplicats</span>}
      </div>
      {result.reportRef && (
        <div style={{ marginTop: 3, fontSize: 10, color: '#cbd5e0' }}>N°{result.reportRef} · Semaine {result.weekNum}</div>
      )}
    </div>
  );
}

export default function MapSidebar({ zone, point, results, backendZone, onClose, onSelectPoint, onBackToZone, points }) {
  const [ptSearch, setPtSearch] = useState('');
  if (!zone) return null;
  const zonePoints = points ?? [];
  const filteredPoints = ptSearch.trim()
    ? zonePoints.filter(pt =>
        (pt.label || '').toLowerCase().includes(ptSearch.toLowerCase()) ||
        (pt.id || '').toLowerCase().includes(ptSearch.toLowerCase()) ||
        (pt.description || '').toLowerCase().includes(ptSearch.toLowerCase())
      )
    : zonePoints;
  const zoneLevel = getZoneLevel(results, zonePoints.map(p => p.id));
  const withData = zonePoints.filter(p => results.has(p.id)).length;

  const s = {
    root: { display: 'flex', flexDirection: 'column', width: 320, minWidth: 320, flexShrink: 0, height: '100%', background: '#ffffff', borderLeft: '1px solid #e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' },
    header: { padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
    body: { flex: 1, overflowY: 'auto', padding: '14px 16px' },
    label: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', marginBottom: 6 },
    card: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 8 },
  };

  return (
    <div className="slide-in" style={s.root}>
      {/* Header */}
      <div style={s.header}>
        {point && (
          <button onClick={onBackToZone} style={{ fontSize: 12, color: '#5c5852', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            &lt; {zone.name}
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {point ? point.label : zone.name}
              {point && isRandomPointId(point.id) && <RandomBadge />}
            </h2>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              {point ? POINT_TYPE_DESC[point.pointType] : ZONE_TYPE_LABEL[zone.category]}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
        </div>
      </div>

      {/* Body */}
      <div style={s.body} className="scrollbar-thin">
        {!point ? (
          <div className="fade-in">
            {/* Données backend temps réel */}
            {backendZone && withData === 0 && (
              <div style={{ ...s.card, marginBottom: 12 }}>
                <div style={s.label}>Données temps réel</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{backendZone.ufc}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>UFC/cm² · seuil {backendZone.seuil}</div>
                  </div>
                  <LevelBadge level={backendZone.status === 'critical' ? 'red' : backendZone.status === 'warning' ? 'orange' : 'green'} />
                </div>
              </div>
            )}

            {/* Status row */}
            <div style={{ ...s.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={s.label}>Statut zone</div>
                <LevelBadge level={zoneLevel} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{withData}<span style={{ fontSize: 13, fontWeight: 400, color: '#94a3b8' }}>/{zonePoints.length}</span></div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>points analysés</div>
              </div>
            </div>

            {/* Distribution bar */}
            {withData > 0 && (() => {
              const levels = ['green', 'absent', 'orange', 'red', 'present'];
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={s.label}>Distribution des résultats</div>
                  {levels.map(lvl => {
                    const count = zonePoints.filter(p => {
                      const rs = results.get(p.id) || [];
                      return rs.some(r => getLevel(r) === lvl);
                    }).length;
                    if (count === 0) return null;
                    const c = LEVEL_COLORS[lvl];
                    const pct = Math.round(count / withData * 100);
                    return (
                      <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                        <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 999 }} />
                        </div>
                        <span style={{ fontSize: 11, color: c, minWidth: 50, textAlign: 'right' }}>{count} · {LEVEL_LABELS[lvl]}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Points list */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={s.label}>Points de prélèvement ({zonePoints.length})</div>
            </div>
            <input
              type="text"
              value={ptSearch}
              onChange={e => setPtSearch(e.target.value)}
              placeholder="Rechercher un point…"
              style={{
                width: '100%', boxSizing: 'border-box', marginBottom: 8,
                padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
                fontSize: 12, color: '#334155', outline: 'none', background: '#f8fafc',
              }}
            />
            {filteredPoints.map(pt => {
              const ptR = results.get(pt.id) || [];
              const lvl = ptR.length > 0 ? getPointOverallLevel(ptR) : 'unknown';
              const c = LEVEL_COLORS[lvl];
              return (
                <button key={pt.id} onClick={() => onSelectPoint(pt)}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: `1px solid ${c}44`, background: c + '0a', marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0, boxShadow: `0 0 5px ${c}88` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                      {pt.label}
                      {isRandomPointId(pt.id) && <RandomBadge />}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.description}</div>
                  </div>
                  {ptR.length > 0 && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      {ptR.map(r => (
                        <span key={r.parameter} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: LEVEL_COLORS[getLevel(r)] + '22', color: LEVEL_COLORS[getLevel(r)], fontWeight: 700 }}>
                          {r.parameter === 'salmonelles' ? 'S' : r.parameter === 'cronobacter' ? 'C' : 'EB'}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="fade-in">
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>{point.description}</p>
            {(() => {
              const ptR = results.get(point.id) || [];
              if (ptR.length === 0) {
                const lastUfc = point.ufc !== null && point.ufc !== undefined ? point.ufc : null;
                const lastDate = point.lastMeasuredAt
                  ? new Date(point.lastMeasuredAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                  : null;
                if (lastUfc !== null) {
                  const st = lastUfc >= (point.seuil ?? 50) ? 'red' : lastUfc >= (point.seuil ?? 50) * 0.8 ? 'orange' : 'green';
                  const stColor = LEVEL_COLORS[st] ?? '#64748b';
                  return (
                    <div style={{ ...s.card, padding: '12px 14px' }}>
                      <div style={{ ...s.label, marginBottom: 8 }}>Dernière valeur connue</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 28, fontWeight: 900, color: stColor, fontFamily: 'Inter, system-ui' }}>
                          {lastUfc < 1 ? '<1' : lastUfc.toFixed(1)}
                        </span>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>UFC/cm²</span>
                      </div>
                      {lastDate && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{lastDate}</div>
                      )}
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8' }}>
                        Ce point n'est pas dans le bulletin actif — valeur issue du dernier import.
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ ...s.card, textAlign: 'center', padding: 24 }}>
                    <div style={{ fontSize: 13, color: '#64748b' }}>Aucun résultat pour ce point</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Importez un bulletin d'analyse</div>
                  </div>
                );
              }
              return ptR.map(r => <ResultBlock key={r.parameter} result={r} />);
            })()}
            <div style={{ ...s.card, marginTop: 8 }}>
              <div style={s.label}>Spécifications réglementaires</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
                {(() => {
                  const seuil = point.seuil ?? backendZone?.seuil ?? null;
                  if (seuil === null) return 'Seuil non encore défini — sera fixé par le prochain bulletin importé pour ce point.';
                  return `EB < ${seuil} UFC/cm² · Salmonelles : absence/cm² · Cronobacter : absence/cm²`;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
