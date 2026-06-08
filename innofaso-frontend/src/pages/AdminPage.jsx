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
  const { points, pointsByZone, updatePoint } = usePoints();
  const [selectedZoneId, setSelectedZoneId] = useState(ZONES[0]?.id ?? "");
  const [editing, setEditing] = useState(null); // objet point en cours
  const [draft,   setDraft]   = useState({ x: "", y: "", ufc: "" });
  const [error,   setError]   = useState("");
  const [saved,   flashSave]  = useFlash();

  const zonePoints = points.filter(p => p.zoneMapId === selectedZoneId);
  const crosshair  = editing && draft.x !== "" && draft.y !== "" ? { x: draft.x, y: draft.y } : null;

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

  return (
    <div className="adm-tab-body">
      <div className="pts-layout">

        {/* ── Colonne gauche : zones + liste ── */}
        <div className="pts-left">
          <div className="pts-zone-bar">
            {ZONES.map(z => (
              <button key={z.id}
                className={`pts-zone-btn${selectedZoneId === z.id ? " pts-zone-btn--active" : ""}`}
                onClick={() => { setSelectedZoneId(z.id); cancel(); }}>
                {z.name}
                <span className="pts-zone-count">{pointsByZone[z.id]?.length ?? 0}</span>
              </button>
            ))}
          </div>

          {(() => {
            const measured = zonePoints.filter(p => p.ufc !== null);
            const maxUfc   = measured.length > 0 ? Math.max(...measured.map(p => p.ufc)) : null;
            return (
              <div className="pts-list-header">
                <span>{ZONES.find(z => z.id === selectedZoneId)?.name} — {zonePoints.length} point{zonePoints.length > 1 ? "s" : ""}</span>
                {maxUfc !== null && (
                  <span className="pts-zone-max">Max&nbsp;<strong>{maxUfc}</strong>&nbsp;UFC/cm²</span>
                )}
              </div>
            );
          })()}

          {zonePoints.length === 0 ? (
            <p className="pts-empty">Aucun point dans cette zone.</p>
          ) : (
            <div className="pts-table-wrap">
              {(() => {
                const measured = zonePoints.filter(p => p.ufc !== null);
                const maxUfc   = measured.length > 0 ? Math.max(...measured.map(p => p.ufc)) : null;
                return (
                  <table className="pts-table">
                    <thead>
                      <tr><th>ID</th><th>Libellé</th><th>Type</th><th>X%</th><th>Y%</th><th>UFC/cm²</th><th></th></tr>
                    </thead>
                    <tbody>
                      {zonePoints.map(pt => {
                        const typeInfo  = PT_TYPES.find(t => t.value === pt.pointType);
                        const isEditing = editing?.id === pt.id;
                        const isMax     = pt.ufc !== null && pt.ufc === maxUfc;
                        return (
                          <tr key={pt.id} className={isEditing ? "pts-row--editing" : ""}>
                            <td><span className="pts-id">{pt.id}</span></td>
                            <td>{pt.label}</td>
                            <td>
                              <span className="pts-type-dot" style={{ background: typeInfo?.color }} />
                              T{pt.pointType}
                            </td>
                            <td className="pts-num">{isEditing ? draft.x : pt.x}</td>
                            <td className="pts-num">{isEditing ? draft.y : pt.y}</td>
                            <td className={`pts-num${isMax ? " pts-ufc-max" : ""}`}>
                              {pt.ufc !== null ? pt.ufc : <span className="pts-ufc-empty">—</span>}
                              {isMax && <span className="pts-ufc-badge" title="Valeur la plus élevée de la zone">▲</span>}
                            </td>
                            <td className="pts-actions">
                              <button className="pts-btn-edit"
                                onClick={() => isEditing ? cancel() : openEdit(pt)}
                                title={isEditing ? "Annuler" : "Modifier"}>
                                {isEditing
                                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}

          <FlashMsg visible={saved} text="Position enregistrée" />
          {error && <p className="pts-error">{error}</p>}
        </div>

        {/* ── Colonne droite : mini-carte + formulaire ── */}
        <div className="pts-right">
          <p className="pts-map-hint">
            {editing
              ? `Déplacement de "${editing.label}" — cliquez sur le plan ou saisissez les coordonnées.`
              : "Glissez un point directement sur le plan pour le déplacer, ou cliquez sur le crayon pour saisir les coordonnées manuellement."}
          </p>
          <MiniMap
            pointsByZone={pointsByZone}
            highlightZone={selectedZoneId}
            crosshair={crosshair}
            editingId={editing?.id ?? null}
            onPlaceClick={editing ? handleMapClick : null}
            onPointDragEnd={!editing ? handleDragEnd : null}
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
