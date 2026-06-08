import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useAdminData } from "../context/AdminDataContext";
import { usePoints } from "../context/PointsContext";
import { ZONES } from "../map/factoryData";
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
  const { zones, updateZone, addZone, deleteZone, thresholds } = useAdminData();
  const [editing, setEditing] = useState(null);
  const [draft,   setDraft]   = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newZ,    setNewZ]    = useState({ label: "", ufc: "", responsible: "", lastCheck: "", nextCheck: "" });
  const [saved,   flashSave]  = useFlash();
  const [confirmDel, setConfirmDel] = useState(null);

  const startEdit = (z) => { setEditing(z.id); setDraft({ ...z }); setShowAdd(false); };
  const cancelEdit = () => { setEditing(null); setDraft({}); };

  const saveEdit = () => {
    updateZone(draft.id, {
      label:       draft.label,
      ufc:         Number(draft.ufc),
      responsible: draft.responsible,
      lastCheck:   draft.lastCheck,
      nextCheck:   draft.nextCheck,
      seuil:       Number(draft.seuil),
    });
    cancelEdit();
    flashSave();
  };

  // Convertit YYYY-MM-DD (input type=date) → DD/MM/YYYY
  const toFR = (val) => {
    if (!val) return new Date().toLocaleDateString("fr-FR");
    if (val.includes("/")) return val;
    const [y, m, d] = val.split("-");
    return d && m && y ? `${d}/${m}/${y}` : new Date().toLocaleDateString("fr-FR");
  };

  const handleAdd = () => {
    if (!newZ.label.trim() || !newZ.ufc) return;
    addZone({
      label:       newZ.label,
      ufc:         Number(newZ.ufc),
      seuil:       thresholds.critical,
      responsible: newZ.responsible || "Non assigné",
      lastCheck:   toFR(newZ.lastCheck),
      nextCheck:   newZ.nextCheck ? toFR(newZ.nextCheck) : "—",
    });
    setNewZ({ label: "", ufc: "", responsible: "", lastCheck: "", nextCheck: "" });
    setShowAdd(false);
    flashSave();
  };

  const confirmDelete = (id) => {
    deleteZone(id);
    setConfirmDel(null);
    flashSave();
  };

  return (
    <div className="adm-tab-body">

      {/* Toolbar */}
      <div className="adm-toolbar">
        <SectionTitle>Gestion des zones ({zones.length})</SectionTitle>
        <div className="adm-toolbar-right">
          <FlashMsg visible={saved} text="Modifications enregistrées" />
          <button className="btn-add" onClick={() => { setShowAdd(true); setEditing(null); }}>
            + Ajouter une zone
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="adm-add-card">
          <div className="adm-add-card-title">Nouvelle zone</div>
          <div className="adm-form-grid">
            <Field label="Nom de la zone *">
              <Inp value={newZ.label} onChange={(v) => setNewZ((p) => ({ ...p, label: v }))} placeholder="ex : Zone Lavage" />
            </Field>
            <Field label="UFC/cm² actuel *">
              <Inp type="number" value={newZ.ufc} onChange={(v) => setNewZ((p) => ({ ...p, ufc: v }))} placeholder="ex : 25" />
            </Field>
            <Field label="Responsable">
              <Inp value={newZ.responsible} onChange={(v) => setNewZ((p) => ({ ...p, responsible: v }))} placeholder="Prénom Nom" />
            </Field>
            <Field label="Dernier contrôle">
              <Inp type="date" value={newZ.lastCheck} onChange={(v) => setNewZ((p) => ({ ...p, lastCheck: v }))} />
            </Field>
            <Field label="Prochain contrôle">
              <Inp type="date" value={newZ.nextCheck} onChange={(v) => setNewZ((p) => ({ ...p, nextCheck: v }))} />
            </Field>
          </div>
          <div className="adm-form-actions">
            <button className="btn-cancel" onClick={() => setShowAdd(false)}>Annuler</button>
            <button className="btn-confirm" onClick={handleAdd} disabled={!newZ.label || !newZ.ufc}>Créer la zone</button>
          </div>
        </div>
      )}

      {/* Zones list */}
      <div className="adm-zones-list">
        {zones.map((z) => (
          <div key={z.id} className={`adm-zone-row${editing === z.id ? " adm-zone-row--editing" : ""}`}>
            {editing === z.id ? (
              /* Edit mode */
              <div className="adm-zone-edit-form">
                <div className="adm-form-grid">
                  <Field label="Nom">
                    <Inp value={draft.label} onChange={(v) => setDraft((p) => ({ ...p, label: v }))} />
                  </Field>
                  <Field label="UFC/cm²">
                    <Inp type="number" value={draft.ufc} onChange={(v) => setDraft((p) => ({ ...p, ufc: v }))} />
                  </Field>
                  <Field label="Seuil limite">
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
              /* View mode */
              <div className="adm-zone-view">
                <div className="adm-zone-view-left">
                  <div className="adm-zone-view-name">{z.label}</div>
                  <div className="adm-zone-view-meta">
                    <StatusBadge status={z.status} />
                    <span className="adm-zone-ufc">{z.ufc} UFC/cm²</span>
                    <span className="adm-zone-resp"><Icon name="user" size={11} strokeWidth={2} /> {z.responsible}</span>
                    <span className="adm-zone-check"><Icon name="calendar" size={11} strokeWidth={2} /> {z.lastCheck}</span>
                  </div>
                </div>
                <div className="adm-zone-view-actions">
                  <button className="btn-edit" onClick={() => startEdit(z)}>
                    <Icon name="edit" size={13} strokeWidth={2} /> Modifier
                  </button>
                  <button className="btn-delete" onClick={() => setConfirmDel(z.id)}>
                    <Icon name="trash" size={13} strokeWidth={2} /> Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirm modal */}
      {confirmDel && (
        <>
          <div className="adm-overlay" onClick={() => setConfirmDel(null)} />
          <div className="adm-confirm-modal">
            <div className="adm-confirm-title">Confirmer la suppression</div>
            <div className="adm-confirm-desc">
              Cette action est irréversible. La zone sera définitivement supprimée.
            </div>
            <div className="adm-form-actions">
              <button className="btn-cancel" onClick={() => setConfirmDel(null)}>Annuler</button>
              <button className="btn-danger" onClick={() => confirmDelete(confirmDel)}>Supprimer</button>
            </div>
          </div>
        </>
      )}
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

  const save = () => {
    const c = Number(draft.critical);
    const w = Number(draft.warning);
    if (w >= c) { setError("Le seuil de surveillance doit être inférieur au seuil critique."); return; }
    if (c <= 0 || w <= 0) { setError("Les seuils doivent être des valeurs positives."); return; }
    setError("");
    setThresholds({ critical: c, warning: w });
    flashSave();
  };

  return (
    <div className="adm-tab-body">
      <SectionTitle>Seuils de contamination</SectionTitle>
      <Desc>
        Ces valeurs déterminent le statut de chaque zone. Modifier un seuil recalcule
        immédiatement la couleur et les alertes sur le tableau de bord.
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
// TAB 3 — INFOS SITE
// ─────────────────────────────────────────────
function SiteTab() {
  const { siteInfo, setSiteInfo } = useAdminData();
  const [draft, setDraft]  = useState({ ...siteInfo });
  const [saved, flashSave] = useFlash();
  const set = (k) => (v) => setDraft((p) => ({ ...p, [k]: v }));

  const save = () => { setSiteInfo({ ...draft }); flashSave(); };

  return (
    <div className="adm-tab-body">
      <SectionTitle>Informations du site</SectionTitle>
      <Desc>Ces informations apparaissent dans l'en-tête du tableau de bord et dans les rapports exportés.</Desc>

      <div className="adm-form-grid">
        <Field label="Nom de l'usine">
          <Inp value={draft.name}    onChange={set("name")}    placeholder="Nom du site" />
        </Field>
        <Field label="Ville">
          <Inp value={draft.city}    onChange={set("city")}    placeholder="Ville" />
        </Field>
        <Field label="Pays">
          <Inp value={draft.country} onChange={set("country")} placeholder="Pays" />
        </Field>
        <Field label="Email de contact">
          <Inp type="email" value={draft.contact} onChange={set("contact")} placeholder="email@site.com" />
        </Field>
        <Field label="Téléphone">
          <Inp value={draft.phone}   onChange={set("phone")}   placeholder="+226 00 00 00 00" />
        </Field>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <button className="btn-save" onClick={save}>Enregistrer</button>
        <FlashMsg visible={saved} text="Informations mises à jour" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 4 — MON COMPTE
// ─────────────────────────────────────────────
function CompteTab() {
  const { user } = useAuth();
  const [fields, setFields] = useState({ old: "", new: "", confirm: "" });
  const [msg, setMsg]       = useState(null);

  const set = (k) => (e) => setFields((p) => ({ ...p, [k]: e.target.value }));

  const savePassword = () => {
    const { old: o, new: n, confirm: c } = fields;
    if (!o || !n || !c)    { setMsg({ err: true, text: "Remplissez tous les champs." }); return; }
    if (n !== c)            { setMsg({ err: true, text: "Les mots de passe ne correspondent pas." }); return; }
    if (n.length < 8)       { setMsg({ err: true, text: "Minimum 8 caractères requis." }); return; }
    setMsg({ err: false, text: "Mot de passe modifié avec succès." });
    setFields({ old: "", new: "", confirm: "" });
    setTimeout(() => setMsg(null), 3000);
  };

  const roleLabel = user?.role === "superadmin" ? "Super Administrateur" : "Éditeur";
  const roleColor = user?.role === "superadmin" ? "#ef4444" : "#f97316";

  return (
    <div className="adm-tab-body">
      {/* Profile card */}
      <div className="adm-profile-card">
        <div className="adm-profile-avatar">{user?.name?.[0] ?? "A"}</div>
        <div className="adm-profile-info">
          <div className="adm-profile-name">{user?.name}</div>
          <div className="adm-profile-role" style={{ color: roleColor }}>{roleLabel}</div>
          <div className="adm-profile-login">@{user?.username}</div>
        </div>
      </div>

      <SectionTitle>Changer le mot de passe</SectionTitle>

      {msg && (
        <div className={`adm-msg-box ${msg.err ? "adm-msg-err" : "adm-msg-ok"}`}>
          {msg.text}
        </div>
      )}

      <div className="adm-form-grid" style={{ maxWidth: 420 }}>
        {[
          { label: "Mot de passe actuel",          key: "old" },
          { label: "Nouveau mot de passe",          key: "new" },
          { label: "Confirmer le nouveau mot de passe", key: "confirm" },
        ].map(({ label, key }) => (
          <Field key={key} label={label}>
            <input
              className="adm-input"
              type="password"
              value={fields[key]}
              onChange={set(key)}
              placeholder="••••••••"
            />
          </Field>
        ))}
      </div>

      <button className="btn-save" onClick={savePassword}>Changer le mot de passe</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 5 — POINTS DE PRELEVEMENT
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

const EMPTY_FORM = { id: "", label: "", zone_map_id: "", x: "", y: "", point_type: "1", description: "" };

// MiniMap — clique pour placer, glisse un point existant pour le déplacer
function MiniMap({ pointsByZone, highlightZone, crosshair, onPlaceClick, onPointDragEnd, editingId }) {
  const svgRef   = useRef(null);
  const dragging = useRef(null); // { id, zoneMapId }

  const svgCoords = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: +Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width)  * 100)).toFixed(1),
      y: +Math.min(100, Math.max(0, ((e.clientY - rect.top)  / rect.height) * 100)).toFixed(1),
    };
  };

  const handleSvgClick = (e) => {
    if (dragging.current) return; // ne pas déclencher click après drag
    if (!onPlaceClick) return;
    const { x, y } = svgCoords(e);
    onPlaceClick(String(x), String(y));
  };

  const handlePointMouseDown = (e, pt) => {
    if (!onPointDragEnd) return;
    e.stopPropagation();
    dragging.current = { id: pt.id, zoneMapId: pt.zoneMapId };
  };

  const handleMouseMove = (e) => {
    if (!dragging.current || !onPointDragEnd) return;
    // visual feedback only — let the parent update via mouseup
  };

  const handleMouseUp = (e) => {
    if (!dragging.current || !onPointDragEnd) return;
    const { x, y } = svgCoords(e);
    onPointDragEnd(dragging.current.id, String(x), String(y));
    dragging.current = null;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, background: "#f9fafb",
               cursor: onPlaceClick ? "crosshair" : "default", userSelect: "none" }}
      onClick={handleSvgClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {ZONES.map(zone => {
        const col = ZONE_COLORS[zone.category] ?? ZONE_COLORS.grey;
        const isHighlight = highlightZone === zone.id;
        const pts = pointsByZone?.[zone.id] ?? zone.points;
        return (
          <g key={zone.id}>
            <rect
              x={px(zone.x)} y={py(zone.y)} width={px(zone.width)} height={py(zone.height)}
              fill={isHighlight ? col.stroke : col.fill}
              stroke={col.stroke} strokeWidth={isHighlight ? 3 : 1.5} opacity={0.85}
            />
            <text x={px(zone.x) + px(zone.width) / 2} y={py(zone.y) + 14}
              textAnchor="middle" fontSize="8" fontWeight="700" fill="#1e3a5f"
              fontFamily="Arial,sans-serif" style={{ pointerEvents: "none" }}>
              {zone.name}
            </text>
            {pts.map(pt => {
              const typeCol  = PT_TYPES.find(t => t.value === pt.pointType)?.color ?? "#9ca3af";
              const isActive = editingId === pt.id;
              const canDrag  = !!onPointDragEnd;
              return (
                <g key={pt.id}
                  style={{ cursor: canDrag ? "grab" : "default" }}
                  onMouseDown={canDrag ? (e) => handlePointMouseDown(e, { ...pt, zoneMapId: zone.id }) : undefined}
                >
                  <circle cx={px(pt.x)} cy={py(pt.y)} r={isActive ? 9 : 6}
                    fill={typeCol} stroke={isActive ? "#ef4444" : "white"}
                    strokeWidth={isActive ? 2.5 : 1.5} opacity={0.95} />
                  {isActive && (
                    <text x={px(pt.x) + 11} y={py(pt.y) + 4} fontSize="8" fill="#ef4444"
                      fontWeight="700" fontFamily="Arial,sans-serif" style={{ pointerEvents: "none" }}>
                      {pt.label}
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
  const { points, pointsByZone, addPoint, updatePoint, deletePoint } = usePoints();
  const [selectedZoneId, setSelectedZoneId] = useState(ZONES[0]?.id ?? "");
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editing,   setEditing]   = useState(null); // id en cours d'édition
  const [showForm,  setShowForm]  = useState(false);
  const [error,     setError]     = useState("");
  const [saved,     flashSave]    = useFlash();
  const [confirmDel, setConfirmDel] = useState(null);

  const selectedZone = ZONES.find(z => z.id === selectedZoneId);
  const zonePoints   = points.filter(p => p.zoneMapId === selectedZoneId);
  const crosshair    = (showForm && form.x && form.y) ? { x: form.x, y: form.y } : null;

  const setF = (k) => (val) => setForm(prev => ({ ...prev, [k]: val }));

  // Drag d'un point existant directement sur la mini-carte (hors mode formulaire)
  const handlePointDragEnd = async (id, x, y) => {
    const pt = points.find(p => p.id === id);
    if (!pt) return;
    setError("");
    try {
      await updatePoint(id, {
        zone_map_id: pt.zoneMapId, label: pt.label,
        x: Number(x), y: Number(y),
        point_type: pt.pointType, description: pt.description,
      });
      flashSave();
    } catch (err) {
      const msg = err.message || "";
      setError(msg.includes("Token") ? "Session expirée — déconnectez-vous et reconnectez-vous." : msg);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, zone_map_id: selectedZoneId });
    setError("");
    setShowForm(true);
  };

  const openEdit = (pt) => {
    setEditing(pt.id);
    setForm({
      id:          pt.id,
      label:       pt.label,
      zone_map_id: pt.zoneMapId,
      x:           String(pt.x),
      y:           String(pt.y),
      point_type:  pt.pointType,
      description: pt.description,
    });
    setError("");
    setShowForm(true);
  };

  const cancel = () => { setShowForm(false); setEditing(null); setError(""); };

  const save = async () => {
    if (!form.id.trim())         return setError("L'identifiant est requis.");
    if (!form.zone_map_id)       return setError("Choisissez une zone.");
    if (form.x === "" || form.y === "") return setError("Les coordonnées X et Y sont requises.");
    setError("");
    try {
      if (editing) {
        await updatePoint(editing, {
          zone_map_id: form.zone_map_id, label: form.label || form.id,
          x: Number(form.x), y: Number(form.y),
          point_type: form.point_type, description: form.description,
        });
      } else {
        await addPoint({
          id: form.id.trim(), zone_map_id: form.zone_map_id,
          label: form.label.trim() || form.id.trim(),
          x: Number(form.x), y: Number(form.y),
          point_type: form.point_type, description: form.description,
        });
      }
      cancel();
      flashSave();
      setSelectedZoneId(form.zone_map_id);
    } catch (err) {
      const msg = err.message || "";
      setError(msg.includes("Token") ? "Session expirée — déconnectez-vous et reconnectez-vous." : msg || "Erreur lors de la sauvegarde.");
    }
  };

  const handleDelete = async (id) => {
    try { await deletePoint(id); setConfirmDel(null); }
    catch (err) { setError(err.message || "Erreur lors de la suppression."); }
  };

  const handleMapClick = (x, y) => {
    setF("x")(x);
    setF("y")(y);
  };

  return (
    <div className="adm-tab-body">
      <div className="pts-layout">

        {/* ── Colonne gauche : zones + liste ── */}
        <div className="pts-left">
          <div className="pts-zone-bar">
            {ZONES.map(z => (
              <button
                key={z.id}
                className={`pts-zone-btn${selectedZoneId === z.id ? " pts-zone-btn--active" : ""}`}
                onClick={() => { setSelectedZoneId(z.id); setShowForm(false); }}
              >
                {z.name}
                <span className="pts-zone-count">{(pointsByZone[z.id]?.length ?? 0)}</span>
              </button>
            ))}
          </div>

          <div className="pts-list-header">
            <span>{selectedZone?.name} — {zonePoints.length} point{zonePoints.length > 1 ? "s" : ""}</span>
            <button className="btn-save" style={{ padding: "5px 14px", fontSize: 12 }} onClick={openAdd}>+ Ajouter</button>
          </div>

          {zonePoints.length === 0 ? (
            <p className="pts-empty">Aucun point dans cette zone.</p>
          ) : (
            <div className="pts-table-wrap">
              <table className="pts-table">
                <thead>
                  <tr><th>ID</th><th>Libellé</th><th>Type</th><th>X%</th><th>Y%</th><th></th></tr>
                </thead>
                <tbody>
                  {zonePoints.map(pt => {
                    const typeInfo = PT_TYPES.find(t => t.value === pt.pointType);
                    return (
                      <tr key={pt.id} className={editing === pt.id ? "pts-row--editing" : ""}>
                        <td><span className="pts-id">{pt.id}</span></td>
                        <td>{pt.label}</td>
                        <td>
                          <span className="pts-type-dot" style={{ background: typeInfo?.color }} />
                          T{pt.pointType}
                        </td>
                        <td className="pts-num">{pt.x}</td>
                        <td className="pts-num">{pt.y}</td>
                        <td className="pts-actions">
                          <button className="pts-btn-edit" onClick={() => openEdit(pt)} title="Modifier">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          {confirmDel === pt.id ? (
                            <span className="pts-confirm-del">
                              <button className="pts-btn-del-ok" onClick={() => handleDelete(pt.id)}>Oui</button>
                              <button className="pts-btn-cancel" onClick={() => setConfirmDel(null)}>Non</button>
                            </span>
                          ) : (
                            <button className="pts-btn-del" onClick={() => setConfirmDel(pt.id)} title="Supprimer">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <FlashMsg visible={saved} text="Enregistré avec succès" />
          {error && <p className="pts-error">{error}</p>}
        </div>

        {/* ── Colonne droite : mini-carte + formulaire ── */}
        <div className="pts-right">
          <p className="pts-map-hint">
            {showForm
              ? "Cliquez sur le plan pour placer le point, ou saisissez les coordonnées manuellement."
              : "Glissez un point sur le plan pour le déplacer. Cliquez sur Modifier pour éditer ses informations."}
          </p>
          <MiniMap
            pointsByZone={pointsByZone}
            highlightZone={selectedZoneId}
            crosshair={crosshair}
            editingId={editing}
            onPlaceClick={showForm ? handleMapClick : null}
            onPointDragEnd={!showForm ? handlePointDragEnd : null}
          />

          {showForm && (
            <div className="pts-form">
              <div className="pts-form-title">{editing ? "Modifier le point" : "Nouveau point"}</div>

              <div className="adm-form-grid">
                <Field label="Identifiant *">
                  <Inp value={form.id} onChange={setF("id")} placeholder="ex : 1.5.9" readOnly={!!editing} />
                </Field>
                <Field label="Libellé (affiché sur la carte)">
                  <Inp value={form.label} onChange={setF("label")} placeholder="même que l'ID si vide" />
                </Field>
                <Field label="Zone *">
                  <select className="adm-input" value={form.zone_map_id} onChange={e => setF("zone_map_id")(e.target.value)}>
                    <option value="">-- Choisir une zone --</option>
                    {ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </Field>
                <Field label="Type de prélèvement *">
                  <select className="adm-input" value={form.point_type} onChange={e => setF("point_type")(e.target.value)}>
                    {PT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="X — horizontal (0–100 %)">
                  <Inp value={form.x} onChange={setF("x")} type="number" placeholder="ex : 30.5 (cliquez sur le plan)" />
                </Field>
                <Field label="Y — vertical (0–100 %)">
                  <Inp value={form.y} onChange={setF("y")} type="number" placeholder="ex : 45.0 (cliquez sur le plan)" />
                </Field>
                <Field label="Description">
                  <Inp value={form.description} onChange={setF("description")} placeholder="ex : Surface interne trémie" />
                </Field>
              </div>

              {error && <p className="pts-error">{error}</p>}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn-save" onClick={save}>{editing ? "Enregistrer" : "Créer"}</button>
                <button className="adm-btn-cancel" onClick={cancel}>Annuler</button>
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
  { id: "site",   label: "Infos site" },
  { id: "compte", label: "Mon compte" },
];

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [tab, setTab]    = useState("zones");

  const renderTab = () => {
    switch (tab) {
      case "zones":  return <ZonesTab />;
      case "points": return <PointsTab />;
      case "seuils": return <SeuilsTab />;
      case "site":   return <SiteTab />;
      case "compte": return <CompteTab />;
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
