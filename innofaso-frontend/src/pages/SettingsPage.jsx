import { useState, useEffect } from "react";
import { useAdminData } from "../context/AdminDataContext";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";

function FeedbackMsg({ msg }) {
  if (!msg) return null;
  return <div className={`settings-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>;
}

function SettingsSection({ title, children }) {
  return (
    <div className="panel settings-panel">
      <div className="panel-header">{title}</div>
      <div className="settings-body">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="settings-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { thresholds, setThresholds, siteInfo, setSiteInfo } = useAdminData();
  const { user } = useAuth();

  // ── Thresholds ──
  const [thresh,      setThresh]      = useState({ warning: 40, critical: 50 });
  const [threshSaving, setThreshSaving] = useState(false);
  const [threshMsg,   setThreshMsg]   = useState(null);

  useEffect(() => {
    setThresh({ warning: thresholds.warning ?? 40, critical: thresholds.critical ?? 50 });
  }, [thresholds]);

  const saveThresholds = async () => {
    const w = Number(thresh.warning);
    const c = Number(thresh.critical);
    if (!Number.isFinite(w) || !Number.isFinite(c) || w < 1 || c < 1) {
      setThreshMsg({ ok: false, text: "Les seuils doivent être des nombres entiers positifs." });
      return;
    }
    if (w >= c) {
      setThreshMsg({ ok: false, text: "Le seuil Surveillance doit être strictement inférieur au seuil Critique." });
      return;
    }
    setThreshSaving(true);
    try {
      await setThresholds({ warning: w, critical: c });
      setThreshMsg({ ok: true, text: "Seuils mis à jour. Les statuts des zones ont été recalculés." });
    } catch (e) {
      setThreshMsg({ ok: false, text: e.message || "Erreur lors de la sauvegarde." });
    } finally {
      setThreshSaving(false);
      setTimeout(() => setThreshMsg(null), 4000);
    }
  };

  // ── Site info ──
  const [site,      setSite]      = useState({});
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteMsg,   setSiteMsg]   = useState(null);

  useEffect(() => {
    setSite({ ...siteInfo });
  }, [siteInfo]);

  const saveSiteInfo = async () => {
    setSiteSaving(true);
    try {
      await setSiteInfo(site);
      setSiteMsg({ ok: true, text: "Informations du site mises à jour." });
    } catch (e) {
      setSiteMsg({ ok: false, text: e.message || "Erreur lors de la sauvegarde." });
    } finally {
      setSiteSaving(false);
      setTimeout(() => setSiteMsg(null), 4000);
    }
  };

  // ── Password ──
  const [pwd,      setPwd]      = useState({ old: "", new1: "", new2: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg,   setPwdMsg]   = useState(null);

  const changePassword = async () => {
    if (pwd.new1 !== pwd.new2) {
      setPwdMsg({ ok: false, text: "Les deux nouveaux mots de passe ne correspondent pas." });
      return;
    }
    if (pwd.new1.length < 8) {
      setPwdMsg({ ok: false, text: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
      return;
    }
    setPwdSaving(true);
    try {
      await authAPI.changePassword(pwd.old, pwd.new1);
      setPwdMsg({ ok: true, text: "Mot de passe modifié avec succès." });
      setPwd({ old: "", new1: "", new2: "" });
    } catch (e) {
      setPwdMsg({ ok: false, text: e.message || "Mot de passe actuel incorrect." });
    } finally {
      setPwdSaving(false);
      setTimeout(() => setPwdMsg(null), 5000);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-title">Paramètres</div>
      <div className="page-sub">Configuration des seuils de contamination et des informations du site</div>

      <div className="settings-grid">

        {/* ── Seuils ── */}
        <SettingsSection title="Seuils de contamination UFC/cm²">
          <p className="settings-info">
            Les statuts des zones sont calculés selon <strong>NF EN ISO 18593</strong> par type
            de point de prélèvement : Type 1 = 10, Type 2 = 50, Type 3 = 100, Type 4 = 500 UFC/cm².
            La surveillance commence à 80 % du seuil. Les valeurs ci-dessous sont conservées
            comme référence complémentaire pour les graphiques.
          </p>

          <Field label="Seuil Surveillance (UFC/cm²)">
            <input
              type="number" min="1" max="999"
              value={thresh.warning}
              onChange={(e) => setThresh((t) => ({ ...t, warning: e.target.value }))}
              className="settings-input orange"
              disabled={!user}
            />
          </Field>

          <Field label="Seuil Critique (UFC/cm²)">
            <input
              type="number" min="1" max="999"
              value={thresh.critical}
              onChange={(e) => setThresh((t) => ({ ...t, critical: e.target.value }))}
              className="settings-input red"
              disabled={!user}
            />
          </Field>

          <div className="settings-thresh-preview">
            <span className="status-badge ok">Conforme</span>
            <span className="settings-thresh-arrow">0–{Number(thresh.warning) - 1} UFC/cm²</span>
            <span className="status-badge warning">Surveillance</span>
            <span className="settings-thresh-arrow">{thresh.warning}–{Number(thresh.critical) - 1}</span>
            <span className="status-badge critical">Critique</span>
            <span className="settings-thresh-arrow">&gt;= {thresh.critical}</span>
          </div>

          <FeedbackMsg msg={threshMsg} />

          <button className="settings-btn" onClick={saveThresholds} disabled={threshSaving || !user}>
            {threshSaving ? "Enregistrement…" : "Enregistrer les seuils"}
          </button>
          {!user && <p className="settings-locked">Connectez-vous en tant qu'administrateur pour modifier.</p>}
        </SettingsSection>

        {/* ── Site info ── */}
        <SettingsSection title="Informations du site">
          {[
            { key: "name",    label: "Nom du site",       type: "text" },
            { key: "city",    label: "Ville",             type: "text" },
            { key: "country", label: "Pays",              type: "text" },
            { key: "contact", label: "Email de contact",  type: "email" },
            { key: "phone",   label: "Téléphone",         type: "tel" },
          ].map(({ key, label, type }) => (
            <Field key={key} label={label}>
              <input
                type={type}
                value={site[key] || ""}
                onChange={(e) => setSite((s) => ({ ...s, [key]: e.target.value }))}
                className="settings-input"
                disabled={!user}
              />
            </Field>
          ))}

          <FeedbackMsg msg={siteMsg} />

          <button className="settings-btn" onClick={saveSiteInfo} disabled={siteSaving || !user}>
            {siteSaving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {!user && <p className="settings-locked">Connectez-vous en tant qu'administrateur pour modifier.</p>}
        </SettingsSection>

        {/* ── Mot de passe (admin seulement) ── */}
        {user && (
          <SettingsSection title={`Changer le mot de passe — ${user.name}`}>
            <p className="settings-info">
              Le nouveau mot de passe doit contenir au moins 8 caractères.
            </p>

            {[
              { key: "old",  label: "Mot de passe actuel",        placeholder: "••••••••" },
              { key: "new1", label: "Nouveau mot de passe",        placeholder: "Min. 8 caractères" },
              { key: "new2", label: "Confirmer le nouveau mot de passe", placeholder: "••••••••" },
            ].map(({ key, label, placeholder }) => (
              <Field key={key} label={label}>
                <input
                  type="password"
                  value={pwd[key]}
                  placeholder={placeholder}
                  onChange={(e) => setPwd((p) => ({ ...p, [key]: e.target.value }))}
                  className="settings-input"
                />
              </Field>
            ))}

            <FeedbackMsg msg={pwdMsg} />

            <button className="settings-btn" onClick={changePassword} disabled={pwdSaving}>
              {pwdSaving ? "Modification…" : "Modifier le mot de passe"}
            </button>
          </SettingsSection>
        )}

      </div>
    </div>
  );
}
