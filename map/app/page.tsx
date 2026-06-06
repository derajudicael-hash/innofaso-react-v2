'use client';

import { useState, useEffect, useRef } from 'react';
import FactoryMap from './components/FactoryMap';
import Sidebar from './components/Sidebar';
import TopBar from './components/UploadPanel';
import FileSidebar from './components/FileSidebar';
import { Zone, SamplingPoint } from './data/factoryData';
import { parseFile } from './utils/labParser';
import { usePersistedFiles } from './hooks/usePersistedFiles';

function App() {
  const { fileEntries, activeFileId, activeResults, addFile, removeFile, clearAll, setActiveFileId } = usePersistedFiles();
  const [isLoading, setIsLoading]         = useState(false);
  const [selectedZone, setSelectedZone]   = useState<Zone | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SamplingPoint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsLoading(true);
    for (const file of Array.from(files)) {
      try {
        const results = await parseFile(file);
        if (results.length === 0) { alert(`Aucun résultat trouvé dans ${file.name}`); continue; }
        addFile(results, file.name);
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : `Erreur: ${file.name}`);
      }
    }
    setIsLoading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  const activeFile = fileEntries.find(f => f.id === activeFileId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, Arial, sans-serif' }}>
      <TopBar activeFile={activeFile} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <FileSidebar
          files={fileEntries}
          activeFileId={activeFileId}
          onSelectFile={id => { setActiveFileId(id); setSelectedZone(null); setSelectedPoint(null); }}
          onRemoveFile={removeFile}
          onClearAll={clearAll}
          onUpload={() => inputRef.current?.click()}
          isLoading={isLoading}
        />
        <input
          ref={inputRef} type="file"
          accept=".docx,.doc,.csv,.xlsx,.xls" multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <FactoryMap
            results={activeResults}
            selectedZone={selectedZone}
            onSelectZone={zone => { setSelectedZone(zone); setSelectedPoint(null); }}
            onSelectPoint={(pt, zone) => { setSelectedZone(zone); setSelectedPoint(pt); }}
          />
          {activeResults.size > 0 && !selectedZone && (
            <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
              <div style={{ padding: '5px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                Cliquez sur une zone · Scroll pour zoomer · Glissez pour naviguer
              </div>
            </div>
          )}
        </div>
        {selectedZone && (
          <Sidebar
            zone={selectedZone}
            point={selectedPoint}
            results={activeResults}
            onClose={() => { setSelectedZone(null); setSelectedPoint(null); }}
            onSelectPoint={pt => setSelectedPoint(pt)}
            onBackToZone={() => setSelectedPoint(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <App />;
}
