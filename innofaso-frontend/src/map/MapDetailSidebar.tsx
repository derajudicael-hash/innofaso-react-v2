import React from 'react';
import { Zone, SamplingPoint } from './factoryData';
import { LabResult, ResultLevel, getLevel, getZoneLevel, getPointOverallLevel, LEVEL_COLORS, LEVEL_LABELS } from './labParser';
import { BackendZone } from './FactoryMap';

interface Props {
  zone: Zone | null;
  point: SamplingPoint | null;
  results: Map<string, LabResult[]>;
  backendZone?: BackendZone;
  onClose: () => void;
  onSelectPoint: (p: SamplingPoint) => void;
  onBackToZone: () => void;
}

const ZONE_TYPE_LABEL: Record<string, string> = {
  white:    '🔵 Zone Blanche — Haut Risque',
  grey:     '🟢 Zone Grise — Faible Risque',
  vestiaire:'🔴 Zone Rouge — Vestiaires',
  laverie:  '🟡 Zone Laverie',
  external: '⚪ Zone Périphérique',
};
const POINT_TYPE_DESC: Record<string, string> = {
  '1': '1.x.x — Surface en contact produit (seuil <10 UFC/cm²)',
  '2': '2.x.x — Surface à proximité (seuil <50 UFC/cm²)',
  '3': '3.x.x — Surface support / sol / mur (seuil <100 UFC/cm²)',
  '4': '4.x.x — Points hors zone blanche (seuil <500 UFC/cm²)',
};

function LevelBadge({ level }: { level: ResultLevel }) {
  const c = LEVEL_COLORS[level];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: c + '20', color: c, border: `1px solid ${c}55` }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
      {LEVEL_LABELS[level]}
    </span>
  );
}

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
        <span style={{ fontSize: 28, fontWeight: 900, color: c }}>
          {isSalmo ? (result.detected ? 'DÉTECTÉE' : 'Absente') : result.numericValue !== null ? (result.numericValue < 1 ? '<1' : result.numericValue.toFixed(1)) : result.rawValue || '—'}
        </span>
        {!isSalmo && <span style={{ fontSize: 13, color: '#94a3b8' }}>UFC/cm²</span>}
        {!isSalmo && result.spec && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>/ seuil &lt;{result.spec}</span>}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 11, color: '#94a3b8' }}>
        {result.date && <span>📅 {result.date}</span>}
        {result.method && <span>🔬 {result.method}</span>}
        {result.replicates > 1 && <span>×{result.replicates} réplicats</span>}
      </div>
      {result.reportRef && <div style={{ marginTop: 3, fontSize: 10, color: '#cbd5e0' }}>N°{result.reportRef} · Semaine {result.weekNum}</div>}
    </div>
  );
}

export default function MapDetailSidebar({ zone, point, results, backendZone, onClose, onSelectPoint, onBackToZone }: Props) {
  if (!zone) return null;
  const zoneLevel = getZoneLevel(results, zone.points.map(p => p.id));
  const withData = zone.points.filter(p => results.has(p.id)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 320, minWidth: 320, height: '100%', background: '#ffffff', borderLeft: '1px solid #e2e8f0', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        {point && (
          <button onClick={onBackToZone} style={{ fontSize: 12, color: '#1a6fa3', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← {zone.name}
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>{point ? point.label : zone.name}</h2>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>{point ? POINT_TYPE_DESC[point.pointType] : ZONE_TYPE_LABEL[zone.category]}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {!point ? (
          <div>
            {/* Backend data */}
            {backendZone && withData === 0 && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>Données temps réel</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>UFC/cm²</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{backendZone.ufc}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Seuil</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{backendZone.seuil}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <LevelBadge level={backendZone.status === 'critical' ? 'red' : backendZone.status === 'warning' ? 'orange' : 'green'} />
                </div>
              </div>
            )}

            {/* Bulletin data */}
            {withData > 0 && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Bulletin importé</div><LevelBadge level={zoneLevel} /></div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{withData}<span style={{ fontSize: 13, fontWeight: 400, color: '#94a3b8' }}>/{zone.points.length}</span></div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>points analysés</div>
                  </div>
                </div>
              </div>
            )}

            {/* Points list */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Points de prélèvement ({zone.points.length})
            </div>
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
          <div>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>{point.description}</p>
            {(() => {
              const ptR = results.get(point.id) || [];
              if (ptR.length === 0) return (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Aucun résultat pour ce point</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Importez un bulletin d'analyse</div>
                </div>
              );
              return ptR.map(r => <ResultBlock key={r.parameter} result={r} />);
            })()}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>Spécifications réglementaires</div>
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
