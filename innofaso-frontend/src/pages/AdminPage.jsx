import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useAdminData } from "../context/AdminDataContext";
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
  return <span className="adm-flash-msg">✓ {text}</span>;
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
          <div className="adm-add-card-title">➕ Nouvelle zone</div>
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
            <div className="adm-confirm-title">⚠️ Confirmer la suppression</div>
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
          <div className="adm-seuil-label">Seuil Critique 🔴</div>
          <div className="adm-seuil-desc">Au-dessus → action immédiate requise</div>
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
          <div className="adm-seuil-label">Seuil Surveillance 🟠</div>
          <div className="adm-seuil-desc">Entre warning et critique → vigilance renforcée</div>
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
          <div className="adm-seuil-label">Zone Conforme 🟢</div>
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
// ADMIN PAGE — orchestrator
// ─────────────────────────────────────────────
const TABS = [
  { id: "zones",  icon: "🗺️",  label: "Zones" },
  { id: "seuils", icon: "⚙️",  label: "Seuils" },
  { id: "site",   icon: "🏭",  label: "Infos site" },
  { id: "compte", icon: "👤",  label: "Mon compte" },
];

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [tab, setTab]    = useState("zones");

  const renderTab = () => {
    switch (tab) {
      case "zones":  return <ZonesTab />;
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
          <div className="adm-page-header-icon">⚙</div>
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
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab body ── */}
      {renderTab()}
    </div>
  );
}
