import { useState } from "react";
import { useComputedZones } from "../hooks/useComputedZones";
import { usePoints } from "../context/PointsContext";
import { useAdminData } from "../context/AdminDataContext";
import { usePersistedFiles } from "../map/usePersistedFiles.js";
import { useAuth } from "../context/AuthContext";
import FactoryMap from "../map/FactoryMap.jsx";
import MapSidebar from "../map/MapSidebar.jsx";
import FileSidebar from "../map/FileSidebar.jsx";
import TopBar from "../map/UploadPanel.jsx";

export default function CartoPage() {
  const { pointsByZone, reload: reloadPoints } = usePoints();
  const { reload: reloadAdminData } = useAdminData();
  const { activeResults, addFile, removeFile, clearAll, fileEntries, activeFileId, setActiveFileId, hydrated } = usePersistedFiles();
  const { computedZones } = useComputedZones(activeResults);
  const { user } = useAuth();

  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importWarning, setImportWarning] = useState(null);
  const [pendingImport, setPendingImport] = useState(null); // { file, results } en attente de confirmation

  const backendZones = computedZones.map(z => ({
    id: z.id, mapId: z.mapId, status: z.status, ufc: z.ufc,
    seuil: z.seuil, label: z.label, hasData: z.hasData,
  }));

  const activeBackendZone = selectedZone
    ? backendZones.find(bz => bz.mapId === selectedZone.id)
    : undefined;

  const activeFile = fileEntries.find(f => f.id === activeFileId);

  // zoneMapId -> nom de la zone, pour le résumé de confirmation
  const zoneLabelByMapId = {};
  computedZones.forEach(z => { zoneLabelByMapId[z.mapId] = z.label; });
  const zoneMapIdByPointId = {};
  Object.entries(pointsByZone).forEach(([zoneMapId, pts]) => {
    pts.forEach(p => { zoneMapIdByPointId[p.id] = zoneMapId; });
  });

  // Étape 1 : on lit et analyse le fichier, MAIS on n'enregistre rien encore —
  // l'admin doit d'abord vérifier le résumé et confirmer explicitement.
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de réimporter le même fichier juste après
    if (!file) return;

    if (!user) {
      alert('Vous devez être connecté en tant qu\'administrateur pour importer des fichiers.');
      return;
    }

    setIsLoading(true);
    setImportWarning(null);
    try {
      const { parseFile } = await import('../map/labParser.js');
      const results = await parseFile(file);
      if (results.length === 0) {
        alert("Aucun résultat reconnu dans ce fichier — vérifiez le format avant de réessayer.");
        return;
      }
      setPendingImport({ file, results });
    } catch (err) {
      console.error('Error parsing file:', err);
      alert('Erreur lors de l\'analyse du fichier');
    } finally {
      setIsLoading(false);
    }
  };

  // Étape 2 : confirmation explicite — c'est seulement ici que les données
  // sont réellement enregistrées (localStorage + backend persistant).
  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const { file, results } = pendingImport;
    setPendingImport(null);
    setIsLoading(true);
    try {
      addFile(results, file.name);

      try {
        const { labResultsAPI } = await import('../services/api.js');
        const sync = await labResultsAPI.import(results, file.name);
        if (sync?.unmatchedIds?.length) {
          setImportWarning(
            `${sync.unmatchedIds.length} identifiant${sync.unmatchedIds.length > 1 ? "s" : ""} du bulletin ` +
            `n'existe${sync.unmatchedIds.length > 1 ? "nt" : ""} pas dans le catalogue des points : ` +
            `${sync.unmatchedIds.join(", ")}. Créez-le${sync.unmatchedIds.length > 1 ? "s" : ""} comme point ` +
            `aléatoire dans Administration → Points de prélèvement pour qu'il${sync.unmatchedIds.length > 1 ? "s" : ""} apparaisse${sync.unmatchedIds.length > 1 ? "nt" : ""} sur la carte.`
          );
        }
        await Promise.all([reloadPoints(), reloadAdminData()]);
      } catch (syncErr) {
        console.error('Erreur de synchronisation avec le backend:', syncErr);
        setImportWarning("Le fichier a été importé localement mais la synchronisation avec le serveur a échoué — les zones risquent d'afficher des valeurs obsolètes.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelImport = () => setPendingImport(null);

  // Résumé affiché dans l'écran de confirmation (calculé côté client, à partir
  // du catalogue de points déjà connu — le contrôle définitif des IDs inconnus
  // reste fait par le backend au moment de la confirmation).
  const importSummary = pendingImport ? (() => {
    const { results } = pendingImport;
    const ebCount    = results.filter(r => r.parameter === 'enterobacteries').length;
    const salmoCount = results.filter(r => r.parameter === 'salmonelles').length;
    const zoneCounts = {};
    const unmatched   = [];
    results.forEach(r => {
      const zoneMapId = zoneMapIdByPointId[r.pointId];
      if (!zoneMapId) { if (!unmatched.includes(r.pointId)) unmatched.push(r.pointId); return; }
      const label = zoneLabelByMapId[zoneMapId] || zoneMapId;
      zoneCounts[label] = (zoneCounts[label] || 0) + 1;
    });
    return {
      fileName:       pendingImport.file.name,
      total:          results.length,
      ebCount, salmoCount,
      zones:          Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]),
      unmatchedCount: unmatched.length,
    };
  })() : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, Arial, sans-serif' }}>
      <TopBar activeFile={activeFile} />
      {importWarning && (
        <div style={{
          background: '#fff3cd', borderBottom: '1px solid #ffe08a', color: '#7a5b00',
          padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <span>⚠️ {importWarning}</span>
          <button
            onClick={() => setImportWarning(null)}
            style={{ background: 'none', border: 'none', color: '#7a5b00', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
            aria-label="Fermer l'avertissement"
          >×</button>
        </div>
      )}

      {pendingImport && importSummary && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 26px', width: 440, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Vérifier avant d'importer</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
              Vérifiez bien que c'est le bon fichier avant de confirmer — une fois importées, les valeurs sont enregistrées dans l'historique partagé par toute l'équipe.
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 8, wordBreak: 'break-all' }}>📄 {importSummary.fileName}</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: '#334155', marginBottom: importSummary.zones.length ? 10 : 0 }}>
                <span><b>{importSummary.total}</b> résultat{importSummary.total > 1 ? 's' : ''}</span>
                {importSummary.ebCount > 0 && <span><b>{importSummary.ebCount}</b> entérobactéries</span>}
                {importSummary.salmoCount > 0 && <span><b>{importSummary.salmoCount}</b> salmonelles</span>}
              </div>
              {importSummary.zones.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Zones touchées</div>
                  {importSummary.zones.map(([label, count]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#334155', padding: '2px 0' }}>
                      <span>{label}</span><span style={{ color: '#64748b' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {importSummary.unmatchedCount > 0 && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: '#7a5b00', background: '#fff3cd', border: '1px solid #ffe08a', borderRadius: 6, padding: '6px 8px' }}>
                  ⚠️ {importSummary.unmatchedCount} identifiant{importSummary.unmatchedCount > 1 ? 's' : ''} inconnu{importSummary.unmatchedCount > 1 ? 's' : ''} du catalogue de points — sera signalé après l'import.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={handleCancelImport} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleConfirmImport} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#1a6fa3', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Confirmer l'import
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <FileSidebar
          files={fileEntries}
          activeFileId={activeFileId}
          onSelectFile={setActiveFileId}
          onRemoveFile={removeFile}
          onClearAll={clearAll}
          onUpload={() => document.getElementById('file-input')?.click()}
          isLoading={isLoading}
        />
        <input
          id="file-input"
          type="file"
          accept=".docx,.csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <div style={{ flex: '1 1 auto', minWidth: 0, position: 'relative', overflow: 'hidden', transition: 'width 0.18s ease' }}>
          <FactoryMap
            results={activeResults}
            backendZones={backendZones}
            dynamicPoints={pointsByZone}
            selectedZone={selectedZone}
            onSelectZone={zone => { setSelectedZone(zone); setSelectedPoint(null); }}
            onSelectPoint={(pt, zone) => { setSelectedZone(zone); setSelectedPoint(pt); }}
          />
        </div>
        {selectedZone && (
          <MapSidebar
            zone={selectedZone}
            point={selectedPoint}
            points={pointsByZone[selectedZone?.id] ?? selectedZone?.points ?? []}
            results={activeResults}
            backendZone={activeBackendZone}
            onClose={() => { setSelectedZone(null); setSelectedPoint(null); }}
            onSelectPoint={setSelectedPoint}
            onBackToZone={() => setSelectedPoint(null)}
          />
        )}
      </div>
    </div>
  );
}
