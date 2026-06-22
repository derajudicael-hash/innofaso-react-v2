import { useState, useRef, useMemo, useEffect, Fragment } from "react";
import { useAuth } from "../context/AuthContext";
import { useAdminData } from "../context/AdminDataContext";
import { usePoints } from "../context/PointsContext";
import { usePersistedFiles } from "../map/usePersistedFiles.js";
import { pointStatus, resultUfc } from "../hooks/useComputedZones";
import { ZONES, isRandomPointId } from "../map/factoryData.js";
import { pendingPointsAPI, correctiveActionsAPI, labResultsAPI, productionBatchesAPI } from "../services/api";
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
// TAB 3 — POINTS DE PRELEVEMENT
// ─────────────────────────────────────────────

// Au-delà de ce délai sans nouvelle mesure réelle, un point reste affiché
// avec son ancien statut sans que rien ne signale qu'il n'est plus à jour —
// aligné sur la fenêtre de rétention de l'historique (RETENTION_DAYS côté
// backend) pour rester cohérent avec le reste de l'application.
const STALE_DAYS = 30;

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

const PT_TYPES = [
  { value: "1", label: "Type 1 — Surface de contact alimentaire", color: "#3b82f6" },
  { value: "2", label: "Type 2 — Équipement",                     color: "#f97316" },
  { value: "3", label: "Type 3 — Environnement",                  color: "#22c55e" },
  { value: "4", label: "Type 4 — Zone grise / externe",           color: "#9ca3af" },
];

function PointsTab() {
  const { points, pointsByZone, updatePoint, addPoint, registerPoint, deletePoint } = usePoints();
  const { activeResults } = usePersistedFiles();
  const [selectedZoneId, setSelectedZoneId] = useState(ZONES[0]?.id ?? "");
  const [editing, setEditing] = useState(null); // objet point en cours
  const [draft,   setDraft]   = useState({ ufc: "" });
  const [error,   setError]   = useState("");
  const [saved,   flashSave]  = useFlash();

  // Notification visible quand un point part en "Points à placer" car la
  // zone n'a pas pu être déterminée automatiquement (ou confirmation quand
  // il a bien été rattaché tout seul) — même type de bannière que l'avis
  // d'import non reconnu sur la Cartographie, pour rester cohérent.
  const [notice, setNotice] = useState(null); // { type: "warning"|"success", text }

  // Récidive : un point dont au moins 2 des 3 derniers relevés réels sont déjà
  // non conformes (pas seulement le dernier) — signal de tendance en plus du
  // statut instantané, sans jamais remplacer le calcul de couleur existant.
  const [recidivePoints, setRecidivePoints] = useState(new Set());
  useEffect(() => {
    if (!selectedZoneId) return;
    labResultsAPI.getPointHistory(selectedZoneId).then(history => {
      const flagged = new Set();
      for (const h of history) {
        const last3 = (h.series || []).slice(-3);
        const nonOk = last3.filter(e => {
          if (e.salmonella) return true;
          if (e.ufc === null || e.ufc === undefined) return false;
          return pointStatus(e.ufc, h.pointType) !== "ok";
        });
        if (last3.length >= 2 && nonOk.length >= 2) flagged.add(h.pointId);
      }
      setRecidivePoints(flagged);
    }).catch(() => setRecidivePoints(new Set()));
  }, [selectedZoneId]);

  const [creating, setCreating]       = useState(false);
  const [createDraft, setCreateDraft] = useState({ type: "1", label: "", description: "" });
  const [createError, setCreateError] = useState("");

  // ── Ajout d'un point officiel (ID réel + description, zone auto-détectée) ──
  const [registering, setRegistering]       = useState(false);
  const [registerDraft, setRegisterDraft]   = useState({ pointId: "", description: "", ufc: "" });
  const [registerError, setRegisterError]   = useState("");
  const [registerBusy, setRegisterBusy]     = useState(false);

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
      const salmoDetected  = liveResults.some(r => r.parameter === "salmonelles"  && r.detected === true);
      const cronoDetected  = liveResults.some(r => r.parameter === "cronobacter" && r.detected === true);
      return {
        ...pt,
        displayUfc: liveUfc ?? pt.ufc,
        hasLiveData: liveResults.length > 0,
        salmoDetected,
        cronoDetected,
      };
    });
  const openEdit = (pt) => {
    cancelCreate();
    cancelRegister();
    setEditing(pt);
    setDraft({ ufc: pt.ufc !== null ? String(pt.ufc) : "" });
    setError("");
  };

  const cancel = () => { setEditing(null); setDraft({ ufc: "" }); setError(""); };

  const save = async () => {
    if (draft.ufc !== "" && (isNaN(Number(draft.ufc)) || Number(draft.ufc) < 0)) return setError("UFC doit être un nombre positif.");
    setError("");
    const ufcVal = draft.ufc !== "" ? Number(draft.ufc) : null;
    try {
      await updatePoint(editing.id, { ufc: ufcVal });
      flashSave();
      cancel();
    } catch (err) {
      const msg = err.message || "";
      setError(msg.includes("Token") ? "Session expirée — reconnectez-vous." : msg || "Erreur serveur.");
    }
  };

  // ── Points aléatoires : création (zone déjà choisie via les onglets,
  // position calculée automatiquement par le serveur) ──────────────────
  const nextSeqForType = (type) => {
    const seqs = points
      .filter(p => isRandomPointId(p.id) && p.id.split(".")[0] === type)
      .map(p => Number(p.id.split(".")[1]))
      .filter(n => !Number.isNaN(n));
    return seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
  };

  const startCreate = () => {
    cancel();
    cancelRegister();
    setCreateError("");
    setCreateDraft({ type: "1", label: "", description: "" });
    setCreating(true);
  };

  const cancelCreate = () => {
    setCreating(false);
    setCreateError("");
    setCreateDraft({ type: "1", label: "", description: "" });
  };

  const submitCreate = async () => {
    if (!createDraft.description.trim()) return setCreateError("Description requise.");
    const seq = nextSeqForType(createDraft.type);
    const id  = `${createDraft.type}.${seq}`;
    setCreateError("");
    try {
      await addPoint({
        id,
        zone_map_id: selectedZoneId,
        label: createDraft.label.trim() || id,
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

  // ── Ajout d'un point officiel (ID réel E.S.N + description + UFC,
  // comme une ligne de bulletin) — la zone est devinée automatiquement par
  // le serveur (salle puis mots-clés) ; si ça échoue, le point part dans
  // "Points à placer" et l'admin en est averti ici même. ────────────────
  const startRegister = () => {
    cancel();
    cancelCreate();
    setRegisterError("");
    setRegisterDraft({ pointId: "", description: "", ufc: "" });
    setRegistering(true);
  };

  const cancelRegister = () => {
    setRegistering(false);
    setRegisterError("");
    setRegisterDraft({ pointId: "", description: "", ufc: "" });
  };

  const submitRegister = async () => {
    if (!registerDraft.pointId.trim())    return setRegisterError("Identifiant requis (ex : 1.1.1).");
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
          text: `Le point "${registerDraft.pointId.trim()}" a été mis dans "Points à placer" — le système n'a pas pu déterminer sa zone automatiquement. Placez-le manuellement depuis cet onglet.`,
        });
      } else {
        const zoneName = ZONES.find(z => z.id === result.zoneMapId)?.name ?? result.zoneMapId;
        setNotice({ type: "success", text: `Point "${registerDraft.pointId.trim()}" créé dans la zone "${zoneName}".` });
      }
      cancelRegister();
    } catch (err) {
      setRegisterError(err.message || "Erreur lors de l'enregistrement du point.");
    } finally {
      setRegisterBusy(false);
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

          {notice && (
            <div className={`pts-notice pts-notice--${notice.type}`}>
              <span>{notice.type === "warning" ? "⚠️ " : "✅ "}{notice.text}</span>
              <button onClick={() => setNotice(null)} aria-label="Fermer">×</button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-add" onClick={startCreate} disabled={creating}>
              <Icon name="plus" size={13} strokeWidth={2.5} /> Point aléatoire
            </button>
            <button className="btn-add" onClick={startRegister} disabled={registering}>
              <Icon name="plus" size={13} strokeWidth={2.5} /> Ajouter un point officiel
            </button>
          </div>

          {zonePoints.length === 0 ? (
            <p className="pts-empty">Aucun point dans cette zone.</p>
          ) : (
            <div className="pts-table-wrap">
              <table className="pts-table">
                <thead>
                  <tr><th>ID</th><th>Libellé</th><th>Type</th><th>UFC/cm²</th><th>Dernière mesure</th><th></th></tr>
                </thead>
                <tbody>
                  {zonePoints.map(pt => {
                    const typeInfo  = PT_TYPES.find(t => t.value === pt.pointType);
                    const isEditing = editing?.id === pt.id;
                    const isMax     = pt.displayUfc !== null && pt.displayUfc === maxUfcInZone;
                    const isRandom  = isRandomPointId(pt.id);
                    const isConfirmingDel = confirmDeleteId === pt.id;
                    const age       = daysSince(pt.lastMeasuredAt);
                    const isStale   = age === null || age > STALE_DAYS;
                    const isRecidive = recidivePoints.has(pt.id);
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
                        <td className={`pts-num${isMax ? " pts-ufc-max" : ""}`}>
                          {pt.displayUfc !== null ? pt.displayUfc : <span className="pts-ufc-empty">—</span>}
                          {isMax && <span className="pts-ufc-badge" title="Valeur la plus élevée de la zone">▲</span>}
                          {pt.hasLiveData && <span className="pts-ufc-live-badge" title="Valeur issue du bulletin actuellement chargé">bulletin</span>}
                          {pt.salmoDetected && <span className="pts-salmo-badge" title="Salmonelles détectées dans le bulletin actuellement chargé">⚠ Salmonelles</span>}
                          {pt.cronoDetected && <span className="pts-salmo-badge" title="Cronobacter (Enterobacter sakazakii) détecté dans le bulletin actuellement chargé">⚠ Cronobacter</span>}
                          {isRecidive && <span className="pts-salmo-badge" title="Au moins 2 des 3 derniers relevés réels de ce point étaient déjà non conformes">↻ Récidive</span>}
                        </td>
                        <td className="pts-num">
                          {age === null ? (
                            <span className="pts-stale-badge" title="Aucune mesure réelle n'a jamais été importée pour ce point">Jamais testé</span>
                          ) : isStale ? (
                            <span className="pts-stale-badge" title={`Dernière mesure il y a ${age} jours — au-delà de la fenêtre de ${STALE_DAYS} jours`}>{age} j (à recontrôler)</span>
                          ) : (
                            <span style={{ color: "var(--txt3)" }}>{age === 0 ? "Aujourd'hui" : `il y a ${age} j`}</span>
                          )}
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

          <FlashMsg visible={saved} text="Enregistré" />
          {error && <p className="pts-error">{error}</p>}
          {deleteError && <p className="pts-error">{deleteError}</p>}
        </div>

        {/* ── Colonne droite : formulaires (plus de carte — la position n'a
             jamais été une donnée réelle, juste un repère visuel) ── */}
        <div className="pts-right">
          {!editing && !creating && !registering && (
            <p className="pts-map-hint">
              Sélectionnez "Modifier" sur un point pour corriger son UFC, ou utilisez les boutons
              ci-contre pour ajouter un point aléatoire ou un point officiel.
            </p>
          )}

          {editing && (
            <div className="pts-form">
              <div className="pts-form-title">Modifier — {editing.label}</div>
              <div className="adm-form-grid">
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
              </div>
              {createError && <p className="pts-error">{createError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn-save" onClick={submitCreate}>Créer le point</button>
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
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 4 — POINTS À PLACER
// ─────────────────────────────────────────────
function pendingStatus(row) {
  if (row.salmonella_detected || row.cronobacter_detected) return "critical";
  if (row.ufc === null || row.ufc === undefined) return null;
  return pointStatus(Number(row.ufc), row.point_type || "1");
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
// TAB 5 — ACTIONS CORRECTIVES (CAPA minimal)
// ─────────────────────────────────────────────
function CorrectiveActionsTab({ onOpenCountChange }) {
  const { points } = usePoints();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [openFormFor, setOpenFormFor] = useState(null); // point_id en cours d'ouverture
  const [draft, setDraft]     = useState({ description: "", responsible: "", dueDate: "" });
  const [busyId, setBusyId]   = useState(null);

  const load = async () => {
    try {
      const data = await correctiveActionsAPI.getAll();
      setActions(data);
      onOpenCountChange?.(data.filter(a => a.status === "ouverte").length);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openActions  = actions.filter(a => a.status === "ouverte");
  const actionedIds  = new Set(openActions.map(a => a.point_id));

  // Lots de production actifs à la date d'ouverture de chaque action — relie
  // une non-conformité environnementale aux lots potentiellement concernés.
  const [batchesByAction, setBatchesByAction] = useState({});
  useEffect(() => {
    openActions.forEach(a => {
      if (batchesByAction[a.id] !== undefined) return;
      const date = new Date(a.opened_at).toISOString().slice(0, 10);
      productionBatchesAPI.getActiveOn(date)
        .then(batches => setBatchesByAction(prev => ({ ...prev, [a.id]: batches })))
        .catch(() => setBatchesByAction(prev => ({ ...prev, [a.id]: [] })));
    });
  }, [openActions]);

  // Points actuellement non conformes (statut basé sur leur propre seuil de
  // type) sans action corrective déjà ouverte.
  const nonConforming = points
    .filter(p => p.ufc !== null && p.ufc !== undefined)
    .map(p => ({ ...p, status: pointStatus(p.ufc, p.pointType) }))
    .filter(p => (p.status === "critical" || p.status === "warning") && !actionedIds.has(p.id));

  const startForm = (pointId) => {
    setOpenFormFor(pointId);
    setDraft({ description: "", responsible: "", dueDate: "" });
    setError("");
  };

  const submitForm = async () => {
    if (!draft.description.trim() || !draft.responsible.trim()) {
      setError("Description et responsable sont requis.");
      return;
    }
    setBusyId(openFormFor);
    setError("");
    try {
      await correctiveActionsAPI.create({
        pointId: openFormFor,
        description: draft.description.trim(),
        responsible: draft.responsible.trim(),
        dueDate: draft.dueDate || null,
      });
      setOpenFormFor(null);
      await load();
    } catch (e) {
      setError(e.message || "Erreur lors de l'ouverture de l'action.");
    } finally {
      setBusyId(null);
    }
  };

  const close = async (id) => {
    setBusyId(id);
    setError("");
    try {
      await correctiveActionsAPI.close(id);
      await load();
    } catch (e) {
      setError(e.message || "Erreur lors de la clôture de l'action.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="adm-tab-body"><Desc>Chargement…</Desc></div>;

  return (
    <div className="adm-tab-body">
      <SectionTitle>Actions correctives ouvertes ({openActions.length})</SectionTitle>
      <Desc>
        Un dépassement de seuil doit aboutir à une décision tracée — pas seulement une couleur sur la
        carte. Ouvrez une action avec un responsable et une échéance, et clôturez-la une fois le
        recontrôle effectué.
      </Desc>

      {error && <p className="pts-error">{error}</p>}

      {openActions.length === 0 ? (
        <p className="pts-empty">Aucune action corrective ouverte.</p>
      ) : (
        <div className="pts-table-wrap">
          <table className="pts-table">
            <thead>
              <tr><th>Point</th><th>Description</th><th>Responsable</th><th>Échéance</th><th>Ouverte</th><th>Lots actifs</th><th></th></tr>
            </thead>
            <tbody>
              {openActions.map(a => {
                const batches = batchesByAction[a.id];
                return (
                  <tr key={a.id}>
                    <td><span className="pts-id">{a.point_id}</span></td>
                    <td>{a.description}</td>
                    <td>{a.responsible}</td>
                    <td>{a.due_date ? new Date(a.due_date).toLocaleDateString('fr-FR') : <span style={{ color: "var(--txt3)" }}>—</span>}</td>
                    <td>{new Date(a.opened_at).toLocaleDateString('fr-FR')} ({a.opened_by})</td>
                    <td>
                      {batches === undefined ? "…" : batches.length === 0
                        ? <span style={{ color: "var(--txt3)", fontStyle: "italic" }}>Aucun lot ouvert</span>
                        : batches.map(b => b.reference).join(", ")}
                    </td>
                    <td className="pts-actions">
                      <button className="btn-save" disabled={busyId === a.id} onClick={() => close(a.id)}>Clôturer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SectionTitle>Points non conformes sans action ({nonConforming.length})</SectionTitle>
      {nonConforming.length === 0 ? (
        <p className="pts-empty">Tous les points non conformes ont déjà une action corrective ouverte.</p>
      ) : (
        <div className="pts-table-wrap">
          <table className="pts-table">
            <thead>
              <tr><th>Point</th><th>Description</th><th>UFC/cm²</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {nonConforming.map(p => (
                <Fragment key={p.id}>
                  <tr>
                    <td><span className="pts-id">{p.id}</span></td>
                    <td>{p.description}</td>
                    <td className="pts-num">{p.ufc}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="pts-actions">
                      {openFormFor !== p.id && (
                        <button className="btn-save" onClick={() => startForm(p.id)}>Ouvrir une action</button>
                      )}
                    </td>
                  </tr>
                  {openFormFor === p.id && (
                    <tr key={`${p.id}-form`}>
                      <td colSpan={5}>
                        <div className="pts-form">
                          <div className="adm-form-grid">
                            <Field label="Description de l'action">
                              <Inp value={draft.description} onChange={(v) => setDraft(d => ({ ...d, description: v }))} placeholder="ex : Nettoyage approfondi + désinfection" />
                            </Field>
                            <Field label="Responsable">
                              <Inp value={draft.responsible} onChange={(v) => setDraft(d => ({ ...d, responsible: v }))} placeholder="ex : Sawadogo Marie" />
                            </Field>
                            <Field label="Échéance (optionnel)">
                              <Inp type="date" value={draft.dueDate} onChange={(v) => setDraft(d => ({ ...d, dueDate: v }))} />
                            </Field>
                          </div>
                          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                            <button className="btn-save" disabled={busyId === p.id} onClick={submitForm}>Enregistrer</button>
                            <button className="adm-btn-cancel" onClick={() => setOpenFormFor(null)}>Annuler</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB 6 — LOTS DE PRODUCTION (traçabilité minimale)
// ─────────────────────────────────────────────
function ProductionBatchesTab() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft]     = useState({ reference: "", dateStart: new Date().toISOString().slice(0, 10) });
  const [busyId, setBusyId]   = useState(null);

  const load = async () => {
    try {
      setBatches(await productionBatchesAPI.getAll());
    } catch (e) {
      setError(e.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!draft.reference.trim() || !draft.dateStart) {
      setError("Référence et date de début sont requises.");
      return;
    }
    setError("");
    try {
      await productionBatchesAPI.create(draft);
      setCreating(false);
      setDraft({ reference: "", dateStart: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (e) {
      setError(e.message || "Erreur lors de l'ouverture du lot.");
    }
  };

  const close = async (id) => {
    setBusyId(id);
    setError("");
    try {
      await productionBatchesAPI.close(id);
      await load();
    } catch (e) {
      setError(e.message || "Erreur lors de la clôture du lot.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="adm-tab-body"><Desc>Chargement…</Desc></div>;

  return (
    <div className="adm-tab-body">
      <div className="adm-toolbar">
        <SectionTitle>Lots de production ({batches.length})</SectionTitle>
      </div>
      <Desc>
        Un lot, c'est tout ce qui a été fabriqué pendant une période donnée — par exemple tout le
        Plumpy'Nut produit le 20 juin 2026. Ouvrez un lot quand la production démarre, clôturez-le
        quand elle s'arrête. À quoi ça sert : si un prélèvement détecte une contamination un jour
        donné (ex. Salmonelle), il faut savoir quels lots étaient justement en cours de fabrication
        ce jour-là pour décider lesquels bloquer ou rappeler — sans cette info, on serait obligé de
        suspecter toute la production de l'usine au lieu d'un seul lot précis. C'est pour ça que
        l'onglet "Actions correctives" affiche les lots actifs à la date de chaque non-conformité.
      </Desc>

      {error && <p className="pts-error">{error}</p>}

      <button className="btn-add" onClick={() => setCreating(c => !c)}>
        <Icon name="plus" size={13} strokeWidth={2.5} /> Nouveau lot
      </button>

      {creating && (
        <div className="pts-form">
          <div className="adm-form-grid">
            <Field label="Référence du lot">
              <Inp value={draft.reference} onChange={(v) => setDraft(d => ({ ...d, reference: v }))} placeholder="ex : LOT-2026-06-21-A" />
            </Field>
            <Field label="Date de début">
              <Inp type="date" value={draft.dateStart} onChange={(v) => setDraft(d => ({ ...d, dateStart: v }))} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn-save" onClick={submit}>Ouvrir le lot</button>
            <button className="adm-btn-cancel" onClick={() => setCreating(false)}>Annuler</button>
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <p className="pts-empty">Aucun lot enregistré.</p>
      ) : (
        <div className="pts-table-wrap">
          <table className="pts-table">
            <thead>
              <tr><th>Référence</th><th>Début</th><th>Fin</th><th>Ouvert par</th><th></th></tr>
            </thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id}>
                  <td><span className="pts-id">{b.reference}</span></td>
                  <td>{new Date(b.date_start).toLocaleDateString('fr-FR')}</td>
                  <td>{b.date_end ? new Date(b.date_end).toLocaleDateString('fr-FR') : <span className="pts-random-badge">En cours</span>}</td>
                  <td>{b.created_by}</td>
                  <td className="pts-actions">
                    {!b.date_end && (
                      <button className="btn-save" disabled={busyId === b.id} onClick={() => close(b.id)}>Clôturer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  const [openActionsCount, setOpenActionsCount] = useState(0);

  // Comptes initiaux indépendants de l'onglet actif, pour que les badges
  // soient visibles même si l'admin n'a pas encore ouvert ces onglets.
  useEffect(() => {
    pendingPointsAPI.getAll().then(data => setPendingCount(data.length)).catch(() => {});
    correctiveActionsAPI.getAll().then(data => setOpenActionsCount(data.filter(a => a.status === "ouverte").length)).catch(() => {});
  }, []);

  const TABS = [
    { id: "zones",    label: "Zones" },
    { id: "points",   label: "Points de prélèvement" },
    { id: "pending",  label: `Points à placer${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
    { id: "actions",  label: `Actions correctives${openActionsCount > 0 ? ` (${openActionsCount})` : ""}` },
    { id: "batches",  label: "Lots de production" },
  ];

  const renderTab = () => {
    switch (tab) {
      case "zones":   return <ZonesTab />;
      case "points":  return <PointsTab />;
      case "pending": return <PendingPointsTab onCountChange={setPendingCount} />;
      case "actions": return <CorrectiveActionsTab onOpenCountChange={setOpenActionsCount} />;
      case "batches": return <ProductionBatchesTab />;
      default:        return <ZonesTab />;
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
