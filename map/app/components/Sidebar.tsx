'use client';

import React from 'react';
import { Zone, SamplingPoint } from '../data/factoryData';
import { LabResult, ResultLevel, getLevel, getZoneLevel, getPointOverallLevel, LEVEL_COLORS, LEVEL_LABELS } from '../utils/labParser';

interface Props {
  zone: Zone | null;
  point: SamplingPoint | null;
  results: Map<string, LabResult[]>;
  onClose: () => void;
  onSelectPoint: (p: SamplingPoint) => void;
  onBackToZone: () => void;
}

function LevelBadge({ level }: { level: ResultLevel }) {
  const c = LEVEL_COLORS[level];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: c + '20', color: c, border: `1px solid ${c}55` }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
      {LEVEL_LABELS[level]}
    </span>
  );
}

const ZONE_TYPE_LABEL: Record<string, string> = {
  white: '🔵 Zone Blanche — Haut Risque',
  grey: '🟢 Zone Grise — Faible Risque',
  vestiaire: '🔴 Zone Rouge — Vestiaires',
};
const POINT_TYPE_DESC: Record<string, string> = {
  '1': '1.x.x — Surface en contact produit (seuil <10 UFC/cm²)',
  '2': '2.x.x — Surface à proximité (seuil <50 UFC/cm²)',
  '3': '3.x.x — Surface support / sol / mur (seuil <100 UFC/cm²)',
  '4': '4.x.x — Points hors zone blanche (seuil <500 UFC/cm²)',
};

function ResultBlock({ result }: { result: LabResult }) {
  const level = getLevel(result);
  const c = LEVEL_COLORS[level];
  const isSalmo = result.parameter === 'salmonelles';
  return (
    <div style={{ background: c + '12', border: `1px solid ${c}44`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {isSalmo ? 'Salmonelles' : 'Entérobactéries'}
        </span>
        <LevelBadge level={level} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: c, fontFamily: 'Inter, system-ui' }}>
          {isSalmo
            ? (result.detected ? 'DÉTECTÉE' : 'Absente')
            : result.numericValue !== null
              ? (result.numericValue < 1 ? '<1' : result.numericValue.toFixed(1))
              : result.rawValue || '—'
          }
        </span>
        {!isSalmo && <span style={{ fontSize: 13, color: '#94a3b8' }}>UFC/cm²</span>}
        {!isSalmo && result.spec && (
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>/ seuil &lt;{result.spec}</span>
        )}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 11, color: '#94a3b8' }}>
        {result.date && <span>📅 {result.date}</span>}
        {result.method && <span>🔬 {result.method}</span>}
        {result.replicates > 1 && <span>×{result.replicates} réplicats</span>}
      </div>
      {result.reportRef && (
        <div style={{ marginTop: 3, fontSize: 10, color: '#cbd5e0' }}>N°{result.reportRef} · Semaine {result.weekNum}</div>
      )}
    </div>
  );
}

export default function Sidebar({ zone, point, results, onClose, onSelectPoint, onBackToZone }: Props) {
  if (!zone) return null;
  const zoneLevel = getZoneLevel(results, zone.points.map(p => p.id));
  const withData = zone.points.filter(p => results.has(p.id)).length;

  const s: Record<string, React.CSSProperties> = {
    root: { display: 'flex', flexDirection: 'column', width: 320, minWidth: 320, height: '100%', background: '#ffffff', borderLeft: '1px solid #e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' },
    header: { padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
    body: { flex: 1, overflowY: 'auto', padding: '14px 16px' },
    label: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#94a3b8', marginBottom: 6 },
    card: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 8 },
  };

  return (
    <div className="slide-in" style={s.root}>
      {/* Header */}
      <div style={s.header}>
        {point && (
          <button onClick={onBackToZone} style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← {zone.name}
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {point ? point.label : zone.name}
            </h2>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              {point ? POINT_TYPE_DESC[point.pointType] : ZONE_TYPE_LABEL[zone.category]}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      </div>

      {/* Body */}
      <div style={s.body} className="scrollbar-thin">
        {!point ? (
          // ── ZONE VIEW ──
          <div className="fade-in">
            {/* Status row */}
            <div style={{ ...s.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={s.label}>Statut zone</div>
                <LevelBadge level={zoneLevel} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{withData}<span style={{ fontSize: 13, fontWeight: 400, color: '#94a3b8' }}>/{zone.points.length}</span></div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>points analysés</div>
              </div>
            </div>

            {/* Distribution bar */}
            {withData > 0 && (() => {
              const levels: ResultLevel[] = ['green', 'absent', 'orange', 'red', 'present'];
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={s.label}>Distribution des résultats</div>
                  {levels.map(lvl => {
                    const count = zone.points.filter(p => {
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
            <div style={s.label}>Points de prélèvement ({zone.points.length})</div>
            {zone.points.map(pt => {
              const ptR = results.get(pt.id) || [];
              const lvl = ptR.length > 0 ? getPointOverallLevel(ptR) : 'unknown';
              const c = LEVEL_COLORS[lvl];
              return (
                <button key={pt.id} onClick={() => onSelectPoint(pt)}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: `1px solid ${c}44`, background: c + '0a', marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0, boxShadow: `0 0 5px ${c}88` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{pt.label}</div>
                    <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.description}</div>
                  </div>
                  {ptR.length > 0 && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      {ptR.map(r => (
                        <span key={r.parameter} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: LEVEL_COLORS[getLevel(r)] + '22', color: LEVEL_COLORS[getLevel(r)], fontWeight: 700 }}>
                          {r.parameter === 'salmonelles' ? 'S' : 'EB'}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          // ── POINT VIEW ──
          <div className="fade-in">
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>{point.description}</p>
            {(() => {
              const ptR = results.get(point.id) || [];
              if (ptR.length === 0) return (
                <div style={{ ...s.card, textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Aucun résultat pour ce point</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Importez un bulletin d'analyse</div>
                </div>
              );
              return ptR.map(r => <ResultBlock key={r.parameter} result={r} />);
            })()}

            {/* Spec reference */}
            <div style={{ ...s.card, marginTop: 8 }}>
              <div style={s.label}>Spécifications réglementaires</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
                {point.pointType === '1' && 'EB < 10 UFC/cm² · Salmonelles : absence/cm²'}
                {point.pointType === '2' && 'EB < 50 UFC/cm² · Salmonelles : absence/cm²'}
                {point.pointType === '3' && 'EB < 100 UFC/cm² · Salmonelles : absence/cm²'}
                {point.pointType === '4' && 'EB < 500 UFC/cm² · Salmonelles : absence/cm²'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
