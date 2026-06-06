'use client';

import React from 'react';
import { ParameterType } from '../utils/labParser';

export interface FileEntry {
  id: string;
  name: string;
  parameter: ParameterType;
  count: number;
  date: string;
  weekNum: string;
  reportRef: string;
}

interface Props {
  files: FileEntry[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  onUpload: () => void;
  isLoading: boolean;
}

const PARAM_COLOR: Record<ParameterType, string> = {
  enterobacteries: '#2563eb',
  salmonelles:     '#d97706',
  unknown:         '#6b7280',
};
const PARAM_SHORT: Record<ParameterType, string> = {
  enterobacteries: 'EB',
  salmonelles:     'Salm.',
  unknown:         '?',
};

export default function FileSidebar({ files, activeFileId, onSelectFile, onRemoveFile, onClearAll, onUpload, isLoading }: Props) {
  return (
    <div style={{
      width: 220, minWidth: 220, height: '100%',
      background: '#ffffff', borderRight: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📂</span> Bulletins d'analyse
        </div>
        <button onClick={onUpload} disabled={isLoading} style={{
          width: '100%', padding: '7px 0', borderRadius: 7,
          background: isLoading ? '#e2e8f0' : '#2563eb',
          color: isLoading ? '#94a3b8' : 'white',
          border: 'none', cursor: isLoading ? 'default' : 'pointer',
          fontSize: 12, fontWeight: 700,
        }}>
          {isLoading ? '⏳ Traitement…' : '+ Importer bulletin'}
        </button>
        <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 4, textAlign: 'center' }}>
          .docx · .csv · .xlsx
        </div>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {files.length === 0 ? (
          <div style={{ padding: '24px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🧫</div>
            Aucun bulletin.<br/>
            Importez vos fichiers<br/>
            <span style={{ color: '#cbd5e0', fontSize: 10 }}>Ils seront sauvegardés<br/>automatiquement</span>
          </div>
        ) : (
          files.map(f => {
            const isActive = f.id === activeFileId;
            const pc = PARAM_COLOR[f.parameter];
            return (
              <div key={f.id}
                onClick={() => onSelectFile(f.id)}
                style={{
                  margin: '2px 8px', padding: '8px 10px', borderRadius: 8,
                  background: isActive ? '#f0f7ff' : 'transparent',
                  border: `1px solid ${isActive ? pc + '88' : 'transparent'}`,
                  cursor: 'pointer', position: 'relative',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                {/* Active bar */}
                {isActive && (
                  <div style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 3, borderRadius: '0 3px 3px 0', background: pc }} />
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: pc + '18', color: pc }}>
                    {PARAM_SHORT[f.parameter]}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveFile(f.id); }}
                    title="Supprimer"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e0', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e0')}
                  >×</button>
                </div>

                {/* Name */}
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={f.name}>
                  {f.name.replace(/\.(docx?|csv|xlsx?)$/i, '')}
                </div>

                {/* Meta */}
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {f.weekNum ? `Semaine ${f.weekNum}` : ''}{f.weekNum && f.date ? ' · ' : ''}{f.date}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                  {f.count} points
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: '#cbd5e0' }}>💾 sauvegardé</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
        {/* Legend */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Légende
        </div>
        {([
          ['#22c55e', 'Conforme'],
          ['#f59e0b', 'Attention'],
          ['#ef4444', 'Non conforme'],
          ['#9ca3af', 'Sans données'],
        ] as [string, string][]).map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: '#475569' }}>{l}</span>
          </div>
        ))}

        {/* Clear all */}
        {files.length > 0 && (
          <button onClick={() => { if (confirm('Effacer tous les bulletins sauvegardés ?')) onClearAll(); }}
            style={{ marginTop: 8, width: '100%', padding: '5px 0', borderRadius: 6, border: '1px solid #fecaca', background: 'white', color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
            🗑 Effacer tout
          </button>
        )}
      </div>
    </div>
  );
}
