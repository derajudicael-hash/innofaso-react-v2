import { useState, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useAdminData } from "../context/AdminDataContext";
import { usePoints } from "../context/PointsContext";
import { usePersistedFiles } from "../map/usePersistedFiles.js";
import { pointStatus, resultUfc } from "../hooks/useComputedZones";
import { ZONES, isRandomPointId } from "../map/factoryData.js";
import Icon from "../components/Icon";

// ─── Shared UI atoms ──────────────────────────
function SectionTitle({ children }) {
  return <h3 className="adm-section-title">{children}</h3>;
}

function Desc({ children }) {
  return <p className="adm-desc">{children}</p>;
}

function Field({ label, children }) {
  return (
    <div className="adm-field">
      <label className="adm-label">{label}</label>
      {children}
    </div>
  );
}

function Inp({ value, onChange, type = "text", readOnly = false, placeholder = "" }) {
  return (
    <input
      className={`adm-input${readOnly ? " adm-input-ro" : ""}`}
      type={type}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
    />
  );
}

function StatusBadge({ status }) {
  const cfg = {
    critical: ["badge-red",    "Critique"],
    warning:  ["badge-orange", "Surveillance"],
    ok:       ["badge-green",  "Conforme"],
  };
  const [cls, label] = cfg[status] ?? cfg.ok;
  return <span className={`adm-badge ${cls}`}>{label}</span>;
}

function FlashMsg({ visible, text }) {
  if (!visible) return null;
  return <span className="adm-flash-msg">{text}</span>;
}

// ─── Hook: flash save feedback ───────────────
function useFlash(ms = 2000) {
  const [on, setOn] = useState(false);
  const flash = () => { setOn(true); setTimeout(() => setOn(false), ms); };
  return [on, flash];
}

// ─────────────────────────────────────────────
// TAB 1 — ZONES
// ─────────────────────────────────────────────
function ZonesTab() {
  const { zones, updateZone } = useAdminData();
  const { pointsByZone, ufcByZone } = usePoints();
  const [editing, setEditing] = useState(null);
  const [draft,   setDraft]   = useState({});
  const [saved,   flashSave]  = useFlash();
  const [confirmDel, setConfirmDel] = useState(null);
  const [error,   setError]   = useState("");

  // Zones avec UFC et statut calculés selon ISO 18593 (seuils par type de point)
  const displayZones = useMemo(() => {
    return zones.filter(z => z.mapId).map(z => {
      const pts    = (pointsByZone[z.mapId] ?? []).filter(p => p.ufc !== null);
      const maxUfc = pts.length > 0 ? Math.max(...pts.map(p => p.ufc)) : null;
      let status   = "ok";
      for (const pt of pts) {
        const st = pointStatus(pt.ufc, pt.pointType);
        if (st === "critical") { status = "critical"; break; }
        if (st === "warning")    status = "warning";
      }
      return { ...z, ufc: maxUfc ?? 0, status };
    });
  }, [zones, pointsByZone]);

  const startEdit = (z) => { setEditing(z.id); setDraft({ ...z }); setError(""); };
  const cancelEdit = () => { setEditing(null); setDraft({}); setError(""); };

  const saveEdit = async () => {
    const z = displayZones.find(z => z.id === draft.id);
    try {
      await updateZone(draft.id, {
        label:       draft.label,
        ufc:         z?.ufc ?? 0,
        responsible: draft.responsible,
        lastCheck:   draft.lastCheck,
        nextCheck:   draft.nextCheck,
        seuil:       Number(draft.seuil),
      });
      setError("");
      cancelEdit();
      flashSave();
    } catch (e) {
      setError(e.message || "Erreur lors de l'enregistrement.");
    }
  };

  return (
    <div className="adm-tab-body">

      {/* Toolbar */}
      <div className="adm-toolbar">
        <SectionTitle>Zones de prélèvement ({displayZones.length})</SectionTitle>
        <FlashMsg visible={saved} text="Modifications enregistrées" />
      </div>
      <p className="adm-desc">
        L'UFC/cm² de chaque zone est calculé automatiquement comme la valeur maximale
        parmi tous ses points de prélèvement. Modifiez le responsable, les dates de contrôle
        et le seuil critique depuis le bouton Modifier.
      </p>

      {/* Zones list */}
      <div className="adm-zones-list">
        {displayZones.map((z) => (
          <div key={z.id} className={`adm-zone-row${editing === z.id ? " adm-zone-row--editing" : ""}`}>
            {editing === z.id ? (
              <div className="adm-zone-edit-form">
                {error && <div className="adm-error-msg">{error}</div>}
                <div className="adm-form-grid">
                  <Field label="Nom">
                    <Inp value={draft.label} onChange={(v) => setDraft((p) => ({ ...p, label: v }))} />
                  </Field>
                  <Field label="Seuil critique (UFC/cm²)">
                    <Inp type="number" value={draft.seuil} onChange={(v) => setDraft((p) => ({ ...p, seuil: v }))} />
                  </Field>
                  <Field label="Responsable">
                    <Inp value={draft.responsible} onChange={(v) => setDraft((p) => ({ ...p, responsible: v }))} />
                  </Field>
                  <Field label="Dernier contrôle">
                    <Inp value={draft.lastCheck} onChange={(v) => setDraft((p) => ({ ...p, lastCheck: v }))} />
                  </Field>
                  <Field label="Prochain contrôle">
                    <Inp value={draft.nextCheck} onChange={(v) => setDraft((p) => ({ ...p, nextCheck: v }))} />
                  </Field>
                </div>
                <div className="adm-form-actions">
                  <button className="btn-cancel" onClick={cancelEdit}>Annuler</button>
                  <button className="btn-confirm" onClick={saveEdit}>Sauvegarder</button>
                </div>
              </div>
            ) : (
              <div className="adm-zone-view">
                <div className="adm-zone-view-left">
                  <div className="adm-zone-view-name">{z.label}</div>
                  <div className="adm-zone-view-meta">
                    <StatusBadge status={z.status} />
                    <span className="adm-zone-ufc">
                      {ufcByZone[z.mapId] !== null && ufcByZone[z.mapId] !== undefined
                        ? `${ufcByZone[z.mapId]} UFC/cm² (max)`
                        : <span style={{ color: "var(--txt3)", fontStyle: "italic" }}>Pas encore mesuré</span>}
                    </span>
                    <span className="adm-zone-resp"><Icon name="user" size={11} strokeWidth={2} /> {z.responsible}</span>
                    <span className="adm-zone-check"><Icon name="calendar" size={11} strokeWidth={2} /> {z.lastCheck}</span>
                  </div>
                </div>
                <div className="adm-zone-view-actions">
                  <button className="btn-edit" onClick={() => startEdit(z)}>
                    <Icon name="edit" size={13} strokeWidth={2} /> Modifier
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 2 — SEUILS
// ─────────────────────────────────────────────
function SeuilsTab() {
  const { thresholds, setThresholds } = useAdminData();
  const [draft, setDraft]   = useState({ ...thresholds });
  const [saved, flashSave]  = useFlash();
  const [error, setError]   = useState("");

  const save = async () => {
    const c = Number(draft.critical);
    const w = Number(draft.warning);
    if (w >= c) { setError("Le seuil de surveillance doit être inférieur au seuil critique."); return; }
    if (c <= 0 || w <= 0) { setError("Les seuils doivent être des valeurs positives."); return; }
    try {
      await setThresholds({ critical: c, warning: w });
      setError("");
      flashSave();
    } catch (e) {
      setError(e.message || "Erreur lors de l'enregistrement.");
    }
  };

  return (
    <div className="adm-tab-body">
      <SectionTitle>Seuils de contamination</SectionTitle>
      <Desc>
        Les statuts appliquent <strong>NF EN ISO 18593</strong> : Type 1 = 10, Type 2 = 50,
        Type 3 = 100, Type 4 = 500 UFC/cm² (surveillance à 80 %). Ces seuils sont conservés
        comme référence complémentaire pour les graphiques historiques.
      </Desc>

      {error && <div className="adm-error-msg">{error}</div>}

      <div className="adm-seuils-grid">
        {/* Critical */}
        <div className="adm-seuil-card seuil-red">
          <div className="adm-seuil-dot" style={{ background: "#ef4444" }} />
          <div className="adm-seuil-label">Seuil Critique</div>
          <div className="adm-seuil-desc">Au-dessus : action immédiate requise</div>
          <div className="adm-seuil-row">
            <input
              className="adm-seuil-input"
              type="number" min="1"
              value={draft.critical}
              onChange={(e) => setDraft((p) => ({ ...p, critical: e.target.value }))}
            />
            <span className="adm-seuil-unit">UFC/cm²</span>
          </div>
        </div>

        {/* Warning */}
        <div className="adm-seuil-card seuil-orange">
          <div className="adm-seuil-dot" style={{ background: "#f97316" }} />
          <div className="adm-seuil-label">Seuil Surveillance</div>
          <div className="adm-seuil-desc">Entre warning et critique : vigilance renforcée</div>
          <div className="adm-seuil-row">
            <input
              className="adm-seuil-input"
              type="number" min="1"
              value={draft.warning}
              onChange={(e) => setDraft((p) => ({ ...p, warning: e.target.value }))}
            />
            <span className="adm-seuil-unit">UFC/cm²</span>
          </div>
        </div>

        {/* OK — readonly */}
        <div className="adm-seuil-card seuil-green">
          <div className="adm-seuil-dot" style={{ background: "#16a34a" }} />
          <div className="adm-seuil-label">Zone Conforme</div>
          <div className="adm-seuil-desc">En dessous du seuil surveillance</div>
          <div className="adm-seuil-row">
            <input className="adm-seuil-input adm-input-ro" type="text" value={`< ${draft.warning}`} readOnly />
            <span className="adm-seuil-unit">UFC/cm²</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <button className="btn-save" onClick={save}>Enregistrer les seuils</button>
        <FlashMsg visible={saved} text="Seuils mis à jour" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 3 — POINTS DE PRELEVEMENT
// ─────────────────────────────────────────────
const VW = 1515, VH = 490;
const px = (p) => (p / 100) * VW;
const py = (p) => (p / 100) * VH;

const ZONE_COLORS = {
  white:    { fill: "#dbeafe", stroke: "#3b82f6" },
  grey:     { fill: "#e5e7eb", stroke: "#9ca3af" },
  vestiaire:{ fill: "#fce7f3", stroke: "#ec4899" },
  laverie:  { fill: "#fef9c3", stroke: "#ca8a04" },
  external: { fill: "#f3f4f6", stroke: "#6b7280" },
};

const PT_TYPES = [
  { value: "1", label: "Type 1 — Surface de contact alimentaire", color: "#3b82f6" },
  { value: "2", label: "Type 2 — Équipement",                     color: "#f97316" },
  { value: "3", label: "Type 3 — Environnement",                  color: "#22c55e" },
  { value: "4", label: "Type 4 — Zone grise / externe",           color: "#9ca3af" },
];

// MiniMap — clique pour placer un nouveau point, glisse pour déplacer un existant
function MiniMap({ pointsByZone, highlightZone, crosshair, onPlaceClick, onPointDragEnd, editingId }) {
  const svgRef      = useRef(null);
  const dragId      = useRef(null);   // id du point en cours de drag
  const dragZone    = useRef(null);   // zoneMapId du point dragué
  const justDragged = useRef(false);  // évite que le click se déclenche après un drag
  const [dragPos, setDragPos] = useState(null); // { id, x, y } en % — feedback visuel

  const pct = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: +Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width)  * 100)).toFixed(1),
      y: +Math.min(100, Math.max(0, ((e.clientY - r.top)  / r.height) * 100)).toFixed(1),
    };
  };

  const onPtMouseDown = (e, id, zoneId) => {
    if (!onPointDragEnd) return;
    e.stopPropagation();
    e.preventDefault();
    dragId.current   = id;
    dragZone.current = zoneId;
    const { x, y } = pct(e);
    setDragPos({ id, x, y });
  };

  const onMouseMove = (e) => {
    if (!dragId.current) return;
    const { x, y } = pct(e);
    setDragPos({ id: dragId.current, x, y });
  };

  const onMouseUp = (e) => {
    if (!dragId.current) return;
    const { x, y } = pct(e);
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 80);
    onPointDragEnd(dragId.current, String(x), String(y));
    dragId.current = null;
    dragZone.current = null;
    setDragPos(null);
  };

  const onSvgClick = (e) => {
    if (justDragged.current || !onPlaceClick) return;
    const { x, y } = pct(e);
    onPlaceClick(String(x), String(y));
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, background: "#f9fafb",
               cursor: dragId.current ? "grabbing" : onPlaceClick ? "crosshair" : "default",
               userSelect: "none", touchAction: "none" }}
      onClick={onSvgClick}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {ZONES.map(zone => {
        const col = ZONE_COLORS[zone.category] ?? ZONE_COLORS.grey;
        const isHL = highlightZone === zone.id;
        const pts  = pointsByZone?.[zone.id] ?? zone.points;
        return (
          <g key={zone.id}>
            <rect x={px(zone.x)} y={py(zone.y)} width={px(zone.width)} height={py(zone.height)}
              fill={isHL ? col.stroke : col.fill} stroke={col.stroke}
              strokeWidth={isHL ? 3 : 1.5} opacity={0.85} />
            <text x={px(zone.x) + px(zone.width) / 2} y={py(zone.y) + 14}
              textAnchor="middle" fontSize="8" fontWeight="700" fill="#1e3a5f"
              fontFamily="Arial,sans-serif" style={{ pointerEvents: "none" }}>
              {zone.name}
            </text>
            {pts.map(pt => {
              const typeCol  = PT_TYPES.find(t => t.value === pt.pointType)?.color ?? "#9ca3af";
              const isActive = editingId === pt.id;
              const isDragging = dragPos?.id === pt.id;
              const cx = isDragging ? px(dragPos.x) : px(pt.x);
              const cy = isDragging ? py(dragPos.y) : py(pt.y);
              return (
                <g key={pt.id}
                  style={{ cursor: onPointDragEnd ? "grab" : "default" }}
                  onMouseDown={onPointDragEnd ? (e) => onPtMouseDown(e, pt.id, zone.id) : undefined}
                >
                  <circle cx={cx} cy={cy} r={isDragging ? 10 : isActive ? 9 : 6}
                    fill={typeCol} stroke={isDragging || isActive ? "#ef4444" : "white"}
                    strokeWidth={isDragging || isActive ? 2.5 : 1.5} opacity={0.95} />
                  {(isActive || isDragging) && (
                    <text x={cx + 12} y={cy + 4} fontSize="8" fill="#ef4444"
                      fontWeight="700" fontFamily="Arial,sans-serif" style={{ pointerEvents: "none" }}>
                      {pt.label}{isDragging ? ` (${dragPos.x}%, ${dragPos.y}%)` : ""}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
      {crosshair && (
        <g style={{ pointerEvents: "none" }}>
          <line x1={px(Number(crosshair.x))} y1={0} x2={px(Number(crosshair.x))} y2={VH}
            stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" opacity={0.7}/>
          <line x1={0} y1={py(Number(crosshair.y))} x2={VW} y2={py(Number(crosshair.y))}
            stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" opacity={0.7}/>
          <circle cx={px(Number(crosshair.x))} cy={py(Number(crosshair.y))} r={8}
            fill="#ef4444" stroke="white" strokeWidth={2}/>
        </g>
      )}
    </svg>
  );
}

function PointsTab() {
  const { points, pointsByZone, updatePoint, addPoint, deletePoint } = usePoints();
  const { activeResults } = usePersistedFiles();
  const [selectedZoneId, setSelectedZoneId] = useState(ZONES[0]?.id ?? "");
  const [editing, setEditing] = useState(null); // objet point en cours
  const [draft,   setDraft]   = useState({ x: "", y: "", ufc: "" });
  const [error,   setError]   = useState("");
  const [saved,   flashSave]  = useFlash();

  const [creating, setCreating]       = useState(false);
  const [createDraft, setCreateDraft] = useState({ type: "1", x: "", y: "", label: "", description: "" });
  const [createError, setCreateError] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError, setDeleteError]          = useState("");

  // Fusionne le bulletin actuellement chargé (localStorage, non garanti synchronisé
  // côté serveur) avec l'UFC déjà persisté — même logique que useComputedZones,
  // pour que l'admin voie toujours l'état le plus à jour, salmonelles incluses.
  const zonePoints = points
    .filter(p => p.zoneMapId === selectedZoneId)
    .map(pt => {
      const liveResults  = activeResults?.get(pt.id) ?? [];
      const liveUfc      = resultUfc(liveResults);
      const salmoDetected = liveResults.some(r => r.parameter === "salmonelles" && r.detected === true);
      return {
        ...pt,
        displayUfc: liveUfc ?? pt.ufc,
        hasLiveData: liveResults.length > 0,
        salmoDetected,
      };
    });
  const crosshair  = editing  && draft.x !== "" && draft.y !== ""       ? { x: draft.x, y: draft.y } : null;
  const createCrosshair = creating && createDraft.x !== "" && createDraft.y !== "" ? { x: createDraft.x, y: createDraft.y } : null;

  const doUpdate = async (id, x, y, ufc) => {
    const pt = points.find(p => p.id === id);
    if (!pt) return;
    const ufcVal = ufc !== undefined ? ufc : pt.ufc;
    try {
      await updatePoint(id, {
        zone_map_id: pt.zoneMapId, label: pt.label,
        x: Number(x), y: Number(y),
        point_type: pt.pointType, description: pt.description,
        ufc: ufcVal,
      });
      flashSave();
    } catch (err) {
      const msg = err.message || "";
      setError(msg.includes("Token") ? "Session expirée — reconnectez-vous." : msg || "Erreur serveur.");
    }
  };

  // Drag direct sur la mini-carte
  const handleDragEnd = (id, x, y) => doUpdate(id, x, y);

  // Clic sur la mini-carte en mode édition → met à jour les coords dans le formulaire
  const handleMapClick = (x, y) => setDraft(d => ({ ...d, x, y }));

  const openEdit = (pt) => {
    cancelCreate();
    setEditing(pt);
    setDraft({ x: String(pt.x), y: String(pt.y), ufc: pt.ufc !== null ? String(pt.ufc) : "" });
    setError("");
  };

  const cancel = () => { setEditing(null); setDraft({ x: "", y: "", ufc: "" }); setError(""); };

  const save = async () => {
    if (draft.x === "" || draft.y === "") return setError("Coordonnées requises.");
    if (draft.ufc !== "" && (isNaN(Number(draft.ufc)) || Number(draft.ufc) < 0)) return setError("UFC doit être un nombre positif.");
    setError("");
    const ufcVal = draft.ufc !== "" ? Number(draft.ufc) : null;
    await doUpdate(editing.id, draft.x, draft.y, ufcVal);
    cancel();
  };

  // ── Points aléatoires : création ──────────────────────────
  const nextSeqForType = (type) => {
    const seqs = points
      .filter(p => isRandomPointId(p.id) && p.id.split(".")[0] === type)
      .map(p => Number(p.id.split(".")[1]))
      .filter(n => !Number.isNaN(n));
    return seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
  };

  const startCreate = () => {
    cancel();
    setCreateError("");
    setCreateDraft({ type: "1", x: "", y: "", label: "", description: "" });
    setCreating(true);
  };

  const cancelCreate = () => {
    setCreating(false);
    setCreateError("");
    setCreateDraft({ type: "1", x: "", y: "", label: "", description: "" });
  };

  const handleCreateMapClick = (x, y) => setCreateDraft(d => ({ ...d, x, y }));

  const submitCreate = async () => {
    if (createDraft.x === "" || createDraft.y === "") return setCreateError("Cliquez sur le plan pour placer le point.");
    if (!createDraft.description.trim()) return setCreateError("Description requise.");
    const seq = nextSeqForType(createDraft.type);
    const id  = `${createDraft.type}.${seq}`;
    setCreateError("");
    try {
      await addPoint({
        id,
        zone_map_id: selectedZoneId,
        label: createDraft.label.trim() || id,
        x: Number(createDraft.x), y: Number(createDraft.y),
        point_type: createDraft.type,
        description: createDraft.description.trim(),
        ufc: null,
      });
      cancelCreate();
      flashSave();
    } catch (err) {
      setCreateError(err.message || "Erreur lors de la création du point.");
    }
  };

  // ── Points aléatoires : suppression ───────────────────────
  const confirmDelete = async (id) => {
    setDeleteError("");
    try {
      await deletePoint(id);
      setConfirmDeleteId(null);
      if (editing?.id === id) cancel();
    } catch (err) {
      setDeleteError(err.message || "Erreur lors de la suppression du point.");
    }
  };

  const measuredPoints = zonePoints.filter(p => p.displayUfc !== null && p.displayUfc !== undefined);
  const maxUfcInZone   = measuredPoints.length > 0 ? Math.max(...measuredPoints.map(p => p.displayUfc)) : null;

  return (
    <div className="adm-tab-body">
      <div className="pts-layout">

        {/* ── Colonne gauche : zones + liste ── */}
        <div className="pts-left">
          <div className="pts-zone-bar">
            {ZONES.map(z => (
              <button key={z.id}
                className={`pts-zone-btn${selectedZoneId === z.id ? " pts-zone-btn--active" : ""}`}
                onClick={() => { setSelectedZoneId(z.id); cancel(); cancelCreate(); }}>
                {z.name}
                <span className="pts-zone-count">{pointsByZone[z.id]?.length ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="pts-list-header">
            <span>{ZONES.find(z => z.id === selectedZoneId)?.name} — {zonePoints.length} point{zonePoints.length > 1 ? "s" : ""}</span>
            {maxUfcInZone !== null && (
              <span className="pts-zone-max">Max&nbsp;<strong>{maxUfcInZone}</strong>&nbsp;UFC/cm²</span>
            )}
          </div>

          <button className="btn-add" onClick={startCreate} disabled={creating}>
            <Icon name="plus" size={13} strokeWidth={2.5} /> Point aléatoire
          </button>

          {zonePoints.length === 0 ? (
            <p className="pts-empty">Aucun point dans cette zone.</p>
          ) : (
            <div className="pts-table-wrap">
              <table className="pts-table">
                <thead>
                  <tr><th>ID</th><th>Libellé</th><th>Type</th><th>X%</th><th>Y%</th><th>UFC/cm²</th><th></th></tr>
                </thead>
                <tbody>
                  {zonePoints.map(pt => {
                    const typeInfo  = PT_TYPES.find(t => t.value === pt.pointType);
                    const isEditing = editing?.id === pt.id;
                    const isMax     = pt.displayUfc !== null && pt.displayUfc === maxUfcInZone;
                    const isRandom  = isRandomPointId(pt.id);
                    const isConfirmingDel = confirmDeleteId === pt.id;
                    return (
                      <tr key={pt.id} className={isEditing ? "pts-row--editing" : ""}>
                        <td>
                          <span className="pts-id">{pt.id}</span>
                          {isRandom && <span className="pts-random-badge" title="Point aléatoire — créé manuellement, hors plan officiel">Aléatoire</span>}
                        </td>
                        <td>{pt.label}</td>
                        <td>
                          <span className="pts-type-dot" style={{ background: typeInfo?.color }} />
                          T{pt.pointType}
                        </td>
                        <td className="pts-num">{isEditing ? draft.x : pt.x}</td>
                        <td className="pts-num">{isEditing ? draft.y : pt.y}</td>
                        <td className={`pts-num${isMax ? " pts-ufc-max" : ""}`}>
                          {pt.displayUfc !== null ? pt.displayUfc : <span className="pts-ufc-empty">—</span>}
                          {isMax && <span className="pts-ufc-badge" title="Valeur la plus élevée de la zone">▲</span>}
                          {pt.hasLiveData && <span className="pts-ufc-live-badge" title="Valeur issue du bulletin actuellement chargé">bulletin</span>}
                          {pt.salmoDetected && <span className="pts-salmo-badge" title="Salmonelles détectées dans le bulletin actuellement chargé">⚠ Salmonelles</span>}
                        </td>
                        <td className="pts-actions">
                          {isConfirmingDel ? (
                            <span className="pts-confirm-del">
                              <button className="pts-btn-del-ok" onClick={() => confirmDelete(pt.id)}>Supprimer</button>
                              <button className="pts-btn-cancel" onClick={() => setConfirmDeleteId(null)}>Annuler</button>
                            </span>
                          ) : (
                            <>
                              <button className="pts-btn-edit"
                                onClick={() => isEditing ? cancel() : openEdit(pt)}
                                title={isEditing ? "Annuler" : "Modifier"}>
                                {isEditing
                                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                              </button>
                              {isRandom && (
                                <button className="pts-btn-del" onClick={() => { setDeleteError(""); setConfirmDeleteId(pt.id); }} title="Supprimer ce point aléatoire">
                                  <Icon name="trash" size={13} strokeWidth={2.5} />
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <FlashMsg visible={saved} text="Position enregistrée" />
          {error && <p className="pts-error">{error}</p>}
          {deleteError && <p className="pts-error">{deleteError}</p>}
        </div>

        {/* ── Colonne droite : mini-carte + formulaire ── */}
        <div className="pts-right">
          <p className="pts-map-hint">
            {editing
              ? `Déplacement de "${editing.label}" — cliquez sur le plan ou saisissez les coordonnées.`
              : creating
              ? "Cliquez sur le plan pour placer le nouveau point aléatoire."
              : "Glissez un point directement sur le plan pour le déplacer, ou cliquez sur le crayon pour saisir les coordonnées manuellement."}
          </p>
          <MiniMap
            pointsByZone={pointsByZone}
            highlightZone={selectedZoneId}
            crosshair={crosshair ?? createCrosshair}
            editingId={editing?.id ?? null}
            onPlaceClick={editing ? handleMapClick : creating ? handleCreateMapClick : null}
            onPointDragEnd={!editing && !creating ? handleDragEnd : null}
          />

          {editing && (
            <div className="pts-form">
              <div className="pts-form-title">Déplacer — {editing.label}</div>
              <div className="adm-form-grid">
                <Field label="X — horizontal (0–100 %)">
                  <Inp value={draft.x} onChange={(v) => setDraft(d => ({ ...d, x: v }))} type="number" placeholder="ex : 30.5" />
                </Field>
                <Field label="Y — vertical (0–100 %)">
                  <Inp value={draft.y} onChange={(v) => setDraft(d => ({ ...d, y: v }))} type="number" placeholder="ex : 45.0" />
                </Field>
                <Field label="UFC/cm² (résultat de labo, optionnel)">
                  <Inp value={draft.ufc} onChange={(v) => setDraft(d => ({ ...d, ufc: v }))} type="number" placeholder="ex : 24 — laisser vide si non mesuré" />
                </Field>
              </div>
              {error && <p className="pts-error">{error}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn-save" onClick={save}>Enregistrer</button>
                <button className="adm-btn-cancel" onClick={cancel}>Annuler</button>
              </div>
            </div>
          )}

          {creating && (
            <div className="pts-form">
              <div className="pts-form-title">
                Nouveau point aléatoire — {ZONES.find(z => z.id === selectedZoneId)?.name}
              </div>
              <div className="adm-form-grid">
                <Field label="Type de point">
                  <select
                    className="adm-input"
                    value={createDraft.type}
                    onChange={(e) => setCreateDraft(d => ({ ...d, type: e.target.value }))}
                  >
                    {PT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Identifiant (généré automatiquement)">
                  <Inp value={`${createDraft.type}.${nextSeqForType(createDraft.type)}`} readOnly />
                </Field>
                <Field label="Libellé (optionnel)">
                  <Inp value={createDraft.label} onChange={(v) => setCreateDraft(d => ({ ...d, label: v }))} placeholder="Par défaut : identique à l'identifiant" />
                </Field>
                <Field label="Description">
                  <Inp value={createDraft.description} onChange={(v) => setCreateDraft(d => ({ ...d, description: v }))} placeholder="ex : Poignée de porte chambre froide" />
                </Field>
                <Field label="X — horizontal (0–100 %)">
                  <Inp value={createDraft.x} onChange={(v) => setCreateDraft(d => ({ ...d, x: v }))} type="number" placeholder="Cliquez sur le plan" />
                </Field>
                <Field label="Y — vertical (0–100 %)">
                  <Inp value={createDraft.y} onChange={(v) => setCreateDraft(d => ({ ...d, y: v }))} type="number" placeholder="Cliquez sur le plan" />
                </Field>
              </div>
              {createError && <p className="pts-error">{createError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn-save" onClick={submitCreate}>Créer le point</button>
                <button className="adm-btn-cancel" onClick={cancelCreate}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADMIN PAGE — orchestrator
// ─────────────────────────────────────────────
const TABS = [
  { id: "zones",  label: "Zones" },
  { id: "points", label: "Points de prélèvement" },
  { id: "seuils", label: "Seuils" },
];

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [tab, setTab]    = useState("zones");

  const renderTab = () => {
    switch (tab) {
      case "zones":  return <ZonesTab />;
      case "points": return <PointsTab />;
      case "seuils": return <SeuilsTab />;
      default:       return <ZonesTab />;
    }
  };

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <div className="adm-page-header">
        <div className="adm-page-header-left">
          <div className="adm-page-header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93A10 10 0 1 0 4.93 19.07"/>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
          </div>
          <div>
            <div className="adm-page-header-title">Administration</div>
            <div className="adm-page-header-sub">
              Connecté&nbsp;·&nbsp;<strong>{user?.name}</strong>&nbsp;·&nbsp;
              <span style={{ color: user?.role === "superadmin" ? "#ef4444" : "#f97316" }}>
                {user?.role === "superadmin" ? "Super Admin" : "Éditeur"}
              </span>
            </div>
          </div>
        </div>
        <button className="btn-logout" onClick={logout}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Déconnexion
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="adm-tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`adm-tab-pill${tab === t.id ? " adm-tab-pill--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab body ── */}
      {renderTab()}
    </div>
  );
}
