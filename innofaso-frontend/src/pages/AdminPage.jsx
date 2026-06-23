import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAdminData } from "../context/AdminDataContext";
import { usePoints } from "../context/PointsContext";
import { pointStatus } from "../hooks/useComputedZones";
import { useMapDisplaySelection } from "../hooks/useMapDisplaySelection.js";
import { ZONES, isRandomPointId } from "../map/factoryData.js";
import { pendingPointsAPI } from "../services/api";
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
  const { zones, updateZone, revertZoneSeuil } = useAdminData();
  const { pointsByZone, ufcByZone } = usePoints();
  const [editing, setEditing] = useState(null);
  const [draft,   setDraft]   = useState({});
  const [seuilWarningOk, setSeuilWarningOk] = useState(false);
  const [saved,   flashSave]  = useFlash();
  const [error,   setError]   = useState("");
  const [revertBusyId, setRevertBusyId] = useState(null);

  // Zones avec UFC et statut calculés contre le seuil propre à chaque zone
  const displayZones = useMemo(() => {
    return zones.filter(z => z.mapId).map(z => {
      const pts    = (pointsByZone[z.mapId] ?? []).filter(p => p.ufc !== null);
      const maxUfc = pts.length > 0 ? Math.max(...pts.map(p => p.ufc)) : null;
      let status   = "ok";
      for (const pt of pts) {
        const st = pointStatus(pt.ufc, z.seuil);
        if (st === "critical") { status = "critical"; break; }
        if (st === "warning")    status = "warning";
      }
      return { ...z, ufc: maxUfc ?? 0, status };
    });
  }, [zones, pointsByZone]);

  const startEdit = (z) => { setEditing(z.id); setDraft({ ...z }); setSeuilWarningOk(false); setError(""); };
  const cancelEdit = () => { setEditing(null); setDraft({}); setSeuilWarningOk(false); setError(""); };

  const originalSeuil = editing ? zones.find(z => z.id === editing)?.seuil : null;
  const seuilChanged  = editing && Number(draft.seuil) !== originalSeuil;

  const saveEdit = async () => {
    if (seuilChanged && !seuilWarningOk) {
      setError("Cochez la case de confirmation pour changer le seuil.");
      return;
    }
    const z = displayZones.find(z => z.id === draft.id);
    try {
      await updateZone(draft.id, {
        label:       draft.label,
        ufc:         z?.ufc ?? 0,
        responsible: draft.responsible,
        seuil:       Number(draft.seuil),
      }, seuilChanged ? true : undefined);
      setError("");
      cancelEdit();
      flashSave();
    } catch (e) {
      setError(e.message || "Erreur lors de l'enregistrement.");
    }
  };

  const revertSeuil = async (id) => {
    setRevertBusyId(id);
    setError("");
    try {
      await revertZoneSeuil(id);
      flashSave();
    } catch (e) {
      setError(e.message || "Erreur lors du retour au seuil automatique.");
    } finally {
      setRevertBusyId(null);
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
        L'UFC/cm² de chaque zone est calculé automatiquement comme la valeur maximale parmi
        tous ses points de prélèvement. Le seuil suit automatiquement les spécifications du
        bulletin importé, sauf si vous le fixez vous-même ci-dessous — dans ce cas, c'est ce
        seuil manuel qui prévaut jusqu'à ce que vous repassiez en automatique.
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
                </div>
                {seuilChanged && (
                  <label className="adm-seuil-warning">
                    <input
                      type="checkbox"
                      checked={seuilWarningOk}
                      onChange={(e) => setSeuilWarningOk(e.target.checked)}
                    />
                    Je comprends que ce changement de seuil recolore aussi tout l'historique déjà
                    enregistré de cette zone (pas seulement les futures mesures), et que le
                    bulletin ne pilotera plus ce seuil automatiquement tant que je ne reviendrai
                    pas en arrière avec "Revenir à l'automatique".
                  </label>
                )}
                <div className="adm-form-actions">
                  <button className="btn-cancel" onClick={cancelEdit}>Annuler</button>
                  <button className="btn-confirm" onClick={saveEdit} disabled={seuilChanged && !seuilWarningOk}>Sauvegarder</button>
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
                    <span
                      className="adm-zone-seuil-mode"
                      title={z.seuilManual
                        ? "Seuil fixé à la main — le bulletin ne le modifie plus"
                        : "Seuil suivant automatiquement les spécifications du bulletin"}
                    >
                      Seuil {z.seuil} ({z.seuilManual ? "manuel" : "auto"})
                    </span>
                  </div>
                </div>
                <div className="adm-zone-view-actions">
                  {z.seuilManual && (
                    <button
                      className="btn-edit"
                      disabled={revertBusyId === z.id}
                      onClick={() => revertSeuil(z.id)}
                      title="Repasser ce seuil en automatique (suit à nouveau le bulletin)"
                    >
                      {revertBusyId === z.id ? "…" : "Revenir à l'automatique"}
                    </button>
                  )}
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
// TAB 3 — POINTS DE PRELEVEMENT
// ─────────────────────────────────────────────

const PT_TYPES = [
  { value: "1", label: "Type 1 — Surface de contact alimentaire", color: "#3b82f6" },
  { value: "2", label: "Type 2 — Équipement",                     color: "#f97316" },
  { value: "3", label: "Type 3 — Environnement",                  color: "#22c55e" },
  { value: "4", label: "Type 4 — Zone grise / externe",           color: "#9ca3af" },
];

// ─────────────────────────────────────────────
// TAB 3 — POINTS DE PRÉLÈVEMENT — ajout uniquement (point aléatoire ou
// officiel). La visualisation/inspection des points existants se fait sur la
// carte (clic sur un point) ; cet onglet ne sert plus qu'à en créer.
// ─────────────────────────────────────────────
function PointsTab() {
  const { points, addPoint, registerPoint } = usePoints();
  const [saved, flashSave] = useFlash();

  // Notification visible quand un point part en "Points à placer" car la
  // zone n'a pas pu être déterminée automatiquement (ou confirmation quand
  // il a bien été rattaché tout seul) — même type de bannière que l'avis
  // d'import non reconnu sur la Cartographie, pour rester cohérent.
  const [notice, setNotice] = useState(null); // { type: "warning"|"success", text }

  // ── Point aléatoire ────────────────────────────────────────
  const [creating, setCreating]       = useState(false);
  const [createDraft, setCreateDraft] = useState({ type: "1", zoneMapId: ZONES[0]?.id ?? "", label: "", description: "" });
  const [createError, setCreateError] = useState("");
  const [createBusy, setCreateBusy]   = useState(false);

  const nextSeqForType = (type) => {
    const seqs = points
      .filter(p => isRandomPointId(p.id) && p.id.split(".")[0] === type)
      .map(p => Number(p.id.split(".")[1]))
      .filter(n => !Number.isNaN(n));
    return seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
  };

  const startCreate = () => {
    cancelRegister();
    setCreateError("");
    setCreateDraft({ type: "1", zoneMapId: ZONES[0]?.id ?? "", label: "", description: "" });
    setCreating(true);
  };
  const cancelCreate = () => { setCreating(false); setCreateError(""); };

  const submitCreate = async () => {
    if (!createDraft.zoneMapId) return setCreateError("Zone requise.");
    if (!createDraft.description.trim()) return setCreateError("Description requise.");
    const seq = nextSeqForType(createDraft.type);
    const id  = `${createDraft.type}.${seq}`;
    setCreateError("");
    setCreateBusy(true);
    try {
      await addPoint({
        id,
        zone_map_id: createDraft.zoneMapId,
        label: createDraft.label.trim() || id,
        point_type: createDraft.type,
        description: createDraft.description.trim(),
        ufc: null,
      });
      cancelCreate();
      flashSave();
    } catch (err) {
      setCreateError(err.message || "Erreur lors de la création du point.");
    } finally {
      setCreateBusy(false);
    }
  };

  // ── Point officiel (ID réel E.S.N + description + UFC, comme une ligne de
  // bulletin) — la zone est devinée automatiquement par le serveur (salle
  // puis mots-clés) ; si ça échoue, le point part dans "Points à placer". ──
  const [registering, setRegistering]     = useState(false);
  const [registerDraft, setRegisterDraft] = useState({ pointId: "", description: "", ufc: "" });
  const [registerError, setRegisterError] = useState("");
  const [registerBusy, setRegisterBusy]   = useState(false);

  const startRegister = () => {
    cancelCreate();
    setRegisterError("");
    setRegisterDraft({ pointId: "", description: "", ufc: "" });
    setRegistering(true);
  };
  const cancelRegister = () => { setRegistering(false); setRegisterError(""); };

  const submitRegister = async () => {
    if (!registerDraft.pointId.trim())     return setRegisterError("Identifiant requis (ex : 1.1.1).");
    if (!registerDraft.description.trim()) return setRegisterError("Description requise.");
    if (registerDraft.ufc !== "" && (isNaN(Number(registerDraft.ufc)) || Number(registerDraft.ufc) < 0)) {
      return setRegisterError("UFC doit être un nombre positif.");
    }
    setRegisterError("");
    setRegisterBusy(true);
    setNotice(null);
    try {
      const result = await registerPoint({
        pointId: registerDraft.pointId.trim(),
        description: registerDraft.description.trim(),
        ufc: registerDraft.ufc !== "" ? Number(registerDraft.ufc) : null,
      });
      if (result.pending) {
        setNotice({
          type: "warning",
          text: `Le point "${registerDraft.pointId.trim()}" a été mis dans "Points à placer" — le système n'a pas pu déterminer sa zone automatiquement. Placez-le depuis cet onglet.`,
        });
      } else {
        const zoneName = ZONES.find(z => z.id === result.zoneMapId)?.name ?? result.zoneMapId;
        setNotice({ type: "success", text: `Point "${registerDraft.pointId.trim()}" créé dans la zone "${zoneName}" — visible sur la carte.` });
      }
      cancelRegister();
    } catch (err) {
      setRegisterError(err.message || "Erreur lors de l'enregistrement du point.");
    } finally {
      setRegisterBusy(false);
    }
  };

  return (
    <div className="adm-tab-body">
      <div className="adm-toolbar">
        <SectionTitle>Ajouter un point de prélèvement</SectionTitle>
        <FlashMsg visible={saved} text="Point créé" />
      </div>
      <p className="adm-desc">
        La carte affiche déjà tous les points connus (cliquez sur un point pour voir son détail) —
        cet onglet sert uniquement à en ajouter de nouveaux.
      </p>

      {notice && (
        <div className={`pts-notice pts-notice--${notice.type}`}>
          <span>{notice.type === "warning" ? "⚠️ " : "✅ "}{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Fermer">×</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="btn-add" onClick={startCreate} disabled={creating}>
          <Icon name="plus" size={13} strokeWidth={2.5} /> Point aléatoire
        </button>
        <button className="btn-add" onClick={startRegister} disabled={registering}>
          <Icon name="plus" size={13} strokeWidth={2.5} /> Ajouter un point officiel
        </button>
      </div>

      {creating && (
        <div className="pts-form">
          <div className="pts-form-title">Nouveau point aléatoire</div>
          <div className="adm-form-grid">
            <Field label="Zone">
              <select
                className="adm-input"
                value={createDraft.zoneMapId}
                onChange={(e) => setCreateDraft(d => ({ ...d, zoneMapId: e.target.value }))}
              >
                {ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </Field>
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
          </div>
          {createError && <p className="pts-error">{createError}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn-save" onClick={submitCreate} disabled={createBusy}>
              {createBusy ? "Création…" : "Créer le point"}
            </button>
            <button className="adm-btn-cancel" onClick={cancelCreate}>Annuler</button>
          </div>
        </div>
      )}

      {registering && (
        <div className="pts-form">
          <div className="pts-form-title">Ajouter un point officiel</div>
          <p className="adm-desc" style={{ marginTop: 0 }}>
            Saisissez le point exactement comme il apparaît dans un bulletin — la zone est
            détectée automatiquement (par salle puis par mots-clés de la description). Si le
            système n'y arrive pas, le point part dans "Points à placer".
          </p>
          <div className="adm-form-grid">
            <Field label="ID Points de prélèvement (ex : 1.1.1)">
              <Inp value={registerDraft.pointId} onChange={(v) => setRegisterDraft(d => ({ ...d, pointId: v }))} placeholder="ex : 1.1.1" />
            </Field>
            <Field label="Description (ex : Couteaux salle de pesée mélange)">
              <Inp value={registerDraft.description} onChange={(v) => setRegisterDraft(d => ({ ...d, description: v }))} placeholder="ex : Couteaux salle de pesée mélange" />
            </Field>
            <Field label="Résultat en UFC Entérobactéries/cm² (optionnel)">
              <Inp value={registerDraft.ufc} onChange={(v) => setRegisterDraft(d => ({ ...d, ufc: v }))} type="number" placeholder="ex : 9 — laisser vide si non mesuré" />
            </Field>
          </div>
          {registerError && <p className="pts-error">{registerError}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn-save" onClick={submitRegister} disabled={registerBusy}>
              {registerBusy ? "Enregistrement…" : "Enregistrer le point"}
            </button>
            <button className="adm-btn-cancel" onClick={cancelRegister}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 4 — POINTS À PLACER
// ─────────────────────────────────────────────
function pendingStatus(row) {
  if (row.salmonella_detected || row.cronobacter_detected) return "critical";
  if (row.ufc === null || row.ufc === undefined) return null;
  // Pas encore de zone (donc pas de seuil de zone) : on retombe sur le
  // seuil indiqué par le bulletin lui-même si on l'a, sinon 50 par défaut.
  return pointStatus(Number(row.ufc), row.seuil ?? 50);
}

function PendingPointsTab({ onCountChange }) {
  const { reload: reloadPoints } = usePoints();
  const { reload: reloadAdminData } = useAdminData();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoneChoice, setZoneChoice] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await pendingPointsAPI.getAll();
      setPending(data);
      onCountChange?.(data.length);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const place = async (id) => {
    const zoneMapId = zoneChoice[id];
    if (!zoneMapId) return;
    setBusyId(id);
    setError("");
    try {
      await pendingPointsAPI.resolve(id, zoneMapId);
      await Promise.all([load(), reloadPoints(), reloadAdminData()]);
    } catch (e) {
      setError(e.message || "Erreur lors du placement du point.");
    } finally {
      setBusyId(null);
    }
  };

  const ignore = async (id) => {
    setBusyId(id);
    setError("");
    try {
      await pendingPointsAPI.dismiss(id);
      await load();
    } catch (e) {
      setError(e.message || "Erreur lors de l'ignorance de l'entrée.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="adm-tab-body"><Desc>Chargement…</Desc></div>;

  return (
    <div className="adm-tab-body">
      <SectionTitle>Points à placer ({pending.length})</SectionTitle>
      <Desc>
        Identifiants relevés dans un bulletin mais dont la salle n'a pas pu être rattachée
        automatiquement à une zone du plan. Choisissez la zone à laquelle ce point appartient
        réellement pour le créer sur la carte — ce choix est mémorisé pour les imports suivants
        de la même salle. Ces résultats ne sont pris en compte dans aucune zone tant qu'ils
        n'ont pas été placés.
      </Desc>

      {error && <p className="pts-error">{error}</p>}

      {pending.length === 0 ? (
        <p className="pts-empty">Aucun point en attente — tous les identifiants des bulletins importés ont été rattachés.</p>
      ) : (
        <div className="pts-table-wrap">
          <table className="pts-table">
            <thead>
              <tr><th>ID</th><th>Salle</th><th>Description</th><th>Résultat</th><th>Zone</th><th></th></tr>
            </thead>
            <tbody>
              {pending.map(row => {
                const status = pendingStatus(row);
                const busy = busyId === row.id;
                return (
                  <tr key={row.id}>
                    <td><span className="pts-id">{row.point_id}</span></td>
                    <td>{row.room !== null ? `Salle ${row.room}` : <span style={{ color: "var(--txt3)", fontStyle: "italic" }}>ID non reconnu</span>}</td>
                    <td>{row.description || <span style={{ color: "var(--txt3)" }}>—</span>}</td>
                    <td>
                      {row.ufc !== null ? `${row.ufc} UFC/cm²` : <span style={{ color: "var(--txt3)" }}>—</span>}
                      {row.salmonella_detected && <span className="pts-salmo-badge" title="Salmonelles détectées">⚠ Salmonelles</span>}
                      {row.cronobacter_detected && <span className="pts-salmo-badge" title="Cronobacter détecté">⚠ Cronobacter</span>}
                      {status && <StatusBadge status={status} />}
                    </td>
                    <td>
                      <select
                        className="adm-input"
                        value={zoneChoice[row.id] || ""}
                        onChange={(e) => setZoneChoice(c => ({ ...c, [row.id]: e.target.value }))}
                      >
                        <option value="">Choisir une zone…</option>
                        {ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                      </select>
                    </td>
                    <td className="pts-actions">
                      <button className="btn-save" disabled={!zoneChoice[row.id] || busy} onClick={() => place(row.id)}>
                        Placer
                      </button>
                      <button className="pts-btn-del" disabled={busy} onClick={() => ignore(row.id)} title="Ignorer cette entrée">
                        <Icon name="trash" size={13} strokeWidth={2.5} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB — BULLETIN AFFICHÉ SUR LA CARTE, L'HISTORIQUE ET LES EXPORTS
// Par défaut, on montre les points du dernier bulletin importé (et tout
// l'historique récent). On peut choisir de revoir un bulletin précédent
// (actif, non annulé) — récent ou ancien — sur la carte, dans l'historique
// (qui se restreint alors à ses points, sans filtre de durée) et dans les
// exports ; tout nouvel import reprend automatiquement la main.
// ─────────────────────────────────────────────
function fmtImportDate(d) {
  const dd = new Date(d);
  return `${String(dd.getDate()).padStart(2, "0")}/${String(dd.getMonth() + 1).padStart(2, "0")}/${dd.getFullYear()} ${String(dd.getHours()).padStart(2, "0")}:${String(dd.getMinutes()).padStart(2, "0")}`;
}

function MapDisplayTab() {
  const { chosenImportId, recentImports, loading, chooseImport } = useMapDisplaySelection();
  const [busy, setBusy] = useState(false);
  const [saved, flashSave] = useFlash();

  const select = async (importId) => {
    setBusy(true);
    try {
      await chooseImport(importId);
      flashSave();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="adm-tab-body"><Desc>Chargement…</Desc></div>;

  return (
    <div className="adm-tab-body">
      <div className="adm-toolbar">
        <SectionTitle>Bulletin affiché sur la carte</SectionTitle>
        <FlashMsg visible={saved} text="Choix enregistré" />
      </div>
      <p className="adm-desc">
        Par défaut, la carte, l'historique et les exports montrent les points du dernier bulletin
        importé. Vous pouvez choisir de revoir un bulletin précédent — récent ou ancien — partout
        sur l'écran ; dès qu'un nouveau bulletin est importé, c'est automatiquement lui qui reprend
        la main, quel que soit le choix fait ici.
      </p>

      <div className="pts-table-wrap">
        <table className="pts-table">
          <thead>
            <tr><th></th><th>Bulletin</th><th>Importé le</th><th>Par</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <input
                  type="radio"
                  name="map-display"
                  checked={!chosenImportId}
                  disabled={busy}
                  onChange={() => select(null)}
                />
              </td>
              <td colSpan={3}><strong>Automatique</strong> — dernier bulletin importé</td>
            </tr>
            {recentImports.map(imp => (
              <tr key={imp.id}>
                <td>
                  <input
                    type="radio"
                    name="map-display"
                    checked={chosenImportId === imp.id}
                    disabled={busy}
                    onChange={() => select(imp.id)}
                  />
                </td>
                <td>{imp.filename}</td>
                <td>{fmtImportDate(imp.imported_at)}</td>
                <td className="txt3">{imp.imported_by}</td>
              </tr>
            ))}
            {recentImports.length === 0 && (
              <tr><td colSpan={4} className="pts-empty">Aucun bulletin importé pour l'instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADMIN PAGE — orchestrator
// ─────────────────────────────────────────────
export default function AdminPage() {
  const { user, logout } = useAuth();
  const [tab, setTab]    = useState("zones");
  const [pendingCount, setPendingCount] = useState(0);

  // Compte initial indépendant de l'onglet actif, pour que le badge soit
  // visible même si l'admin n'a pas encore ouvert cet onglet.
  useEffect(() => {
    pendingPointsAPI.getAll().then(data => setPendingCount(data.length)).catch(() => {});
  }, []);

  const TABS = [
    { id: "zones",      label: "Zones" },
    { id: "points",     label: "Points de prélèvement" },
    { id: "pending",    label: `Points à placer${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
    { id: "mapdisplay", label: "Bulletin sur la carte" },
  ];

  const renderTab = () => {
    switch (tab) {
      case "zones":      return <ZonesTab />;
      case "points":     return <PointsTab />;
      case "pending":    return <PendingPointsTab onCountChange={setPendingCount} />;
      case "mapdisplay": return <MapDisplayTab />;
      default:           return <ZonesTab />;
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
