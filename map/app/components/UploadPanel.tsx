'use client';
// Thin top bar — logo + status only. Upload is now in FileSidebar.
import React from 'react';
import { FileEntry } from './FileSidebar';

interface Props {
  activeFile: FileEntry | null;
}

export default function TopBar({ activeFile }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
      height: 46, background: '#ffffff', borderBottom: '1px solid #e2e8f0',
      fontFamily: 'Inter, Arial, sans-serif', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 13 }}>✦</div>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', letterSpacing: '-0.3px' }}>
          Inno<span style={{ color: '#2563eb' }}>Faso</span>
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: '#e2e8f0' }}/>

      {activeFile ? (
        <span style={{ fontSize: 12, color: '#475569' }}>
          Affichage : <strong style={{ color: '#0f172a' }}>
            {activeFile.parameter === 'enterobacteries' ? 'Entérobactéries' : 'Salmonelles'}
          </strong>
          {activeFile.weekNum && ` · Semaine ${activeFile.weekNum}`}
          {activeFile.date && ` · ${activeFile.date}`}
        </span>
      ) : (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>Importez un bulletin depuis le panneau gauche</span>
      )}
    </div>
  );
}
