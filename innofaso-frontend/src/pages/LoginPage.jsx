import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function EyeIcon({ open }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function LoginPage({ onBack }) {
  const { login, loginError, setLoginError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(username.trim(), password);
    setLoading(false);
  };

  return (
    <div className="login-root">
      <div className="login-card">

        {/* Brand */}
        <div className="login-brand-block">
          <img
            src="/innofaso-logo.png"
            alt="InnoFaso"
            className="login-logo-image"
          />
          <div className="login-brand-sub">Espace Administration</div>
        </div>

        {/* Error banner */}
        {loginError && (
          <div className="login-error-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {loginError}
          </div>
        )}

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>

          {/* Username */}
          <div className="login-field">
            <label className="login-label">Identifiant</label>
            <div className="login-input-wrap">
              <svg className="lif-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                className="login-input"
                type="text"
                placeholder="Votre identifiant"
                value={username}
                autoComplete="username"
                onChange={(e) => { setUsername(e.target.value.trimStart()); setLoginError(""); }}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="login-label">Mot de passe</label>
            <div className="login-input-wrap">
              <svg className="lif-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                className="login-input"
                type={showPwd ? "text" : "password"}
                placeholder="Votre mot de passe"
                value={password}
                autoComplete="current-password"
                onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                required
              />
              <button type="button" className="login-eye-btn" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}>
                <EyeIcon open={showPwd} />
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            className="login-submit-btn"
            type="submit"
            disabled={loading || !username || !password}
          >
            {loading
              ? <span className="login-spinner" />
              : <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Se connecter
                </>
            }
          </button>
        </form>

        {/* Back */}
        <button className="login-back-btn" onClick={() => { setLoginError(""); onBack(); }}>
          Retour au tableau de bord
        </button>


      </div>
    </div>
  );
}
