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
  const { siteInfo, setSiteInfo } = useAdminData();
  const { user } = useAuth();

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
  const [pwdConfirmed, setPwdConfirmed] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg,   setPwdMsg]   = useState(null);

  const changePassword = async () => {
    if (!pwdConfirmed) {
      setPwdMsg({ ok: false, text: "Cochez la case de confirmation pour valider le changement." });
      return;
    }
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
      setPwdConfirmed(false);
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
      <div className="page-sub">Informations du site et compte administrateur</div>

      <div className="settings-grid">

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

            <label className="settings-pwd-warning">
              <input
                type="checkbox"
                checked={pwdConfirmed}
                onChange={(e) => setPwdConfirmed(e.target.checked)}
              />
              Je confirme vouloir changer ce mot de passe maintenant (pas par erreur).
            </label>

            <FeedbackMsg msg={pwdMsg} />

            <button className="settings-btn" onClick={changePassword} disabled={pwdSaving || !pwdConfirmed}>
              {pwdSaving ? "Modification…" : "Modifier le mot de passe"}
            </button>
          </SettingsSection>
        )}

      </div>
    </div>
  );
}
