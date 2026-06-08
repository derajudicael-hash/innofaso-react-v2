import { useRef, useState } from "react";
import FactoryMap  from "../map/FactoryMap";
import Sidebar     from "../map/Sidebar";
import TopBar      from "../map/UploadPanel";
import FileSidebar from "../map/FileSidebar";
import { parseFile }         from "../map/labParser";
import { usePersistedFiles } from "../map/usePersistedFiles";
import { useComputedZones }  from "../hooks/useComputedZones";
import { usePoints }         from "../context/PointsContext";

export default function CartoPage() {
  const { computedZones } = useComputedZones();
  const { pointsByZone } = usePoints();
  const { fileEntries, activeFileId, activeResults, hydrated, addFile, removeFile, clearAll, setActiveFileId } = usePersistedFiles();
  const [isLoading, setIsLoading]         = useState(false);
  const [selectedZone, setSelectedZone]   = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const inputRef = useRef(null);

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

  // Statuts calculés selon ISO 18593 (seuils par type de point, pire cas)
  const mappedBackendZones = computedZones.map(z => ({
    id: z.id, mapId: z.mapId, status: z.status, ufc: z.ufc,
    seuil: z.seuil, label: z.label, hasData: z.hasData,
  }));

  // Find the backend zone corresponding to the selected factory zone
  const activeBackendZone = selectedZone
    ? mappedBackendZones.find(bz => bz.mapId === selectedZone.id)
    : undefined;

  if (!hydrated) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f8fafc', color: '#94a3b8', fontFamily: 'Inter, Arial, sans-serif', fontSize: 14 }}>
      Chargement…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, Arial, sans-serif' }}>
      <TopBar activeFile={activeFile} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left file sidebar */}
        <FileSidebar
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

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <FactoryMap
            results={activeResults}
            backendZones={mappedBackendZones}
            dynamicPoints={pointsByZone}
            selectedZone={selectedZone}
            onSelectZone={zone => { setSelectedZone(zone); setSelectedPoint(null); }}
            onSelectPoint={(pt, zone) => { setSelectedZone(zone); setSelectedPoint(pt); }}
          />
          {activeResults.size === 0 && !selectedZone && (
            <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
              <div style={{ padding: '5px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                Cliquez sur une zone · Scroll pour zoomer · Glissez pour naviguer
              </div>
            </div>
          )}
        </div>

        {/* Right detail sidebar */}
        {selectedZone && (
          <Sidebar
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
