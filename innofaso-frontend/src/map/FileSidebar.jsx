'use client';

import React, { useState, useEffect } from 'react';

const COLLAPSE_KEY = 'innofaso_filesidebar_collapsed';
const EXPANDED_W = 220;
const COLLAPSED_W = 56;

function ChevronIcon({ dir }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  );
}

export default function FileSidebar({ files, activeFileId, onSelectFile, onRemoveFile, onClearAll, onUpload, isLoading, isAdmin = true }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  const PARAM_COLOR = {
    enterobacteries: '#5c5852',
    salmonelles:     '#d97706',
    cronobacter:     '#7c3aed',
    unknown:         '#6b7280',
  };
  const PARAM_SHORT = {
    enterobacteries: 'EB',
    salmonelles:     'Salm.',
    cronobacter:     'Crono.',
    unknown:         '?',
  };

  // ── Vue réduite : juste le strict nécessaire pour rouvrir / importer ──
  if (collapsed) {
    return (
      <div style={{
        width: COLLAPSED_W, minWidth: COLLAPSED_W, height: '100%',
        background: '#ffffff', borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 0 14px', gap: 12, flexShrink: 0,
        fontFamily: 'Inter, Arial, sans-serif',
        transition: 'width 0.18s ease',
      }}>
        <button
          onClick={() => setCollapsed(false)}
          title="Afficher les bulletins d'analyse"
          style={{
            width: 30, height: 30, borderRadius: 7,
            border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronIcon dir="right" />
        </button>

        {isAdmin ? (
          <button
            onClick={onUpload}
            disabled={isLoading}
            title="Importer bulletin"
            style={{
              width: 34, height: 34, borderRadius: 8, border: 'none',
              background: isLoading ? '#e2e8f0' : '#5c5852',
              color: isLoading ? '#94a3b8' : 'white',
              cursor: isLoading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, fontWeight: 700, lineHeight: 1,
            }}
          >
            +
          </button>
        ) : (
          <button
            title="Connexion administrateur requise pour importer"
            disabled
            style={{
              width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0',
              background: '#f8fafc', color: '#94a3b8',
              cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15,
            }}
          >
            🔒
          </button>
        )}

        {files.length > 0 && (
          <div
            title={`${files.length} bulletin${files.length > 1 ? 's' : ''} importé${files.length > 1 ? 's' : ''}`}
            style={{
              fontSize: 10, fontWeight: 800, color: '#5c5852', background: '#f5f0ec',
              borderRadius: 999, padding: '2px 7px', minWidth: 18, textAlign: 'center',
            }}
          >
            {files.length}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Mini légende (juste les pastilles) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['#22c55e', '#f59e0b', '#ef4444', '#9ca3af'].map((c) => (
            <span key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Vue complète ──
  return (
    <div style={{
      width: EXPANDED_W, minWidth: EXPANDED_W, height: '100%',
      background: '#ffffff', borderRight: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      fontFamily: 'Inter, Arial, sans-serif',
      transition: 'width 0.18s ease',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span>Bulletins d'analyse</span>
          <button
            onClick={() => setCollapsed(true)}
            title="Réduire la colonne"
            style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              border: '1px solid #e2e8f0', background: '#ffffff', color: '#94a3b8',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#5c5852'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            <ChevronIcon dir="left" />
          </button>
        </div>
        {isAdmin ? (
          <button onClick={onUpload} disabled={isLoading} style={{
            width: '100%', padding: '7px 0', borderRadius: 7,
            background: isLoading ? '#e2e8f0' : '#5c5852',
            color: isLoading ? '#94a3b8' : 'white',
            border: 'none', cursor: isLoading ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 700,
          }}>
            {isLoading ? 'Traitement…' : '+ Importer bulletin'}
          </button>
        ) : (
          <div style={{
            width: '100%', padding: '7px 0', borderRadius: 7, textAlign: 'center',
            background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0',
            fontSize: 12, fontWeight: 600,
          }}>
            🔒 Connexion admin requise
          </div>
        )}
        <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 4, textAlign: 'center' }}>
          .docx · .csv · .xlsx
        </div>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {files.length === 0 ? (
          <div style={{ padding: '24px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 11, lineHeight: 1.6 }}>
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
                  background: isActive ? '#f5f0ec' : 'transparent',
                  border: `1px solid ${isActive ? pc + '88' : 'transparent'}`,
                  cursor: 'pointer', position: 'relative',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
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
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#cbd5e0'}
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
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: '#cbd5e0' }}>sauvegardé</span>
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
        {[
          ['#22c55e', 'Conforme'],
          ['#f59e0b', 'Attention'],
          ['#ef4444', 'Non conforme'],
          ['#9ca3af', 'Sans données'],
        ].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: '#475569' }}>{l}</span>
          </div>
        ))}

        {/* Clear all */}
        {files.length > 0 && (
          <button onClick={() => { if (confirm('Effacer tous les bulletins sauvegardés ?')) onClearAll(); }}
            style={{ marginTop: 8, width: '100%', padding: '5px 0', borderRadius: 6, border: '1px solid #fecaca', background: 'white', color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
            Effacer tout
          </button>
        )}
      </div>
    </div>
  );
}
