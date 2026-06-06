import { useState, useRef } from "react";
import FactoryMap       from "../map/FactoryMap";
import MapDetailSidebar from "../map/MapDetailSidebar";
import MapFileSidebar   from "../map/MapFileSidebar";
import { usePersistedFiles } from "../map/usePersistedFiles";
import { parseFile }    from "../map/labParser";
import { useAdminData } from "../context/AdminDataContext";

export default function CartoPage() {
  const { zones } = useAdminData();
  const { fileEntries, activeFileId, activeResults, addFile, removeFile, clearAll, setActiveFileId } = usePersistedFiles();
  const [isLoading, setIsLoading]         = useState(false);
  const [selectedZone, setSelectedZone]   = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const inputRef = useRef(null);

  // Map backend zones to the format FactoryMap expects
  const backendZones = (zones || []).map(z => ({
    id:      z.id,
    mapId:   z.mapId,
    label:   z.label,
    status:  z.status,
    ufc:     z.ufc,
    seuil:   z.seuil,
  }));

  // Find backend zone matching selected factory zone
  const activeBackendZone = selectedZone
    ? backendZones.find(bz => bz.mapId === selectedZone.id)
    : undefined;

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    setIsLoading(true);
    for (const file of Array.from(files)) {
      try {
        const results = await parseFile(file);
        if (results.length === 0) { alert(`Aucun résultat trouvé dans ${file.name}`); continue; }
        addFile(results, file.name);
      } catch (e) {
        alert(e instanceof Error ? e.message : `Erreur: ${file.name}`);
      }
    }
    setIsLoading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  const activeFile = fileEntries.find(f => f.id === activeFileId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'DM Sans, Inter, Arial, sans-serif' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 44, background: '#ffffff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#1a6fa3,#0e4d7a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 12 }}>✦</div>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', letterSpacing: '-0.3px' }}>
            Inno<span style={{ color: '#1a6fa3' }}>Faso</span>
            <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12, marginLeft: 8 }}>Cartographie</span>
          </span>
        </div>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        {activeFile ? (
          <span style={{ fontSize: 12, color: '#475569' }}>
            Affichage : <strong style={{ color: '#0f172a' }}>
              {activeFile.parameter === 'enterobacteries' ? 'Entérobactéries' : 'Salmonelles'}
            </strong>
            {activeFile.weekNum && ` · Semaine ${activeFile.weekNum}`}
            {activeFile.date && ` · ${activeFile.date}`}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {backendZones.length > 0 ? `${backendZones.length} zones chargées depuis la base de données` : 'Importez un bulletin depuis le panneau gauche'}
          </span>
        )}
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <MapFileSidebar
          files={fileEntries}
          activeFileId={activeFileId}
          onSelectFile={id => { setActiveFileId(id); setSelectedZone(null); setSelectedPoint(null); }}
          onRemoveFile={removeFile}
          onClearAll={clearAll}
          onUpload={() => inputRef.current?.click()}
          isLoading={isLoading}
        />

        <input ref={inputRef} type="file" accept=".docx,.doc,.csv,.xlsx,.xls" multiple
          style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <FactoryMap
            results={activeResults}
            backendZones={backendZones}
            selectedZone={selectedZone}
            onSelectZone={zone => { setSelectedZone(zone); setSelectedPoint(null); }}
            onSelectPoint={(pt, zone) => { setSelectedZone(zone); setSelectedPoint(pt); }}
          />
          {activeResults.size === 0 && backendZones.length === 0 && (
            <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
              <div style={{ padding: '5px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                Cliquez sur une zone · Scroll pour zoomer · Glissez pour naviguer
              </div>
            </div>
          )}
        </div>

        {selectedZone && (
          <MapDetailSidebar
            zone={selectedZone}
            point={selectedPoint}
            results={activeResults}
            backendZone={activeBackendZone}
            onClose={() => { setSelectedZone(null); setSelectedPoint(null); }}
            onSelectPoint={pt => setSelectedPoint(pt)}
            onBackToZone={() => setSelectedPoint(null)}
          />
        )}
      </div>
    </div>
  );
}
