// src/context/AuthContext.jsx  — VERSION BACKEND
import { createContext, useContext, useState, useEffect } from "react";
import { authAPI, getToken, setToken, removeToken } from "../services/api";

const AuthContext = createContext(null);

// Clés localStorage à effacer quand une nouvelle installation est détectée
const LOCAL_KEYS_TO_CLEAR = [
  "innofaso_token",
  "hygienemap_entries_v2",
  "hygienemap_results_v2",
];

export function AuthProvider({ children }) {
  const [user,       setUser]       = useState(null);
  const [loginError, setLoginError] = useState("");
  const [loading,    setLoading]    = useState(true);

  // Au démarrage : vérifie l'install_id auprès du backend pour détecter
  // un nouveau setup (npm run setup/reset), puis restaure la session.
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/health");
        const { install_id } = await res.json();
        if (install_id) {
          const stored = localStorage.getItem("innofaso_install_id");
          if (stored && stored !== install_id) {
            // Nouvelle installation détectée → vider toutes les données locales
            LOCAL_KEYS_TO_CLEAR.forEach(k => localStorage.removeItem(k));
            localStorage.setItem("innofaso_install_id", install_id);
            setLoading(false);
            return; // session non restaurée → page de connexion
          }
          localStorage.setItem("innofaso_install_id", install_id);
        }
      } catch {
        // Backend pas encore démarré — on continue sans vérification
      }

      // Restaurer la session depuis localStorage
      const token = getToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.exp * 1000 > Date.now()) {
            setUser({ id: payload.id, username: payload.username, name: payload.name, role: payload.role });
          } else {
            removeToken();
          }
        } catch {
          removeToken();
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  // Déconnexion automatique si le serveur rejette le token (401)
  // Déclenché par api.js via l'événement "innofaso:session-expired"
  useEffect(() => {
    const handleExpired = () => setUser(null);
    window.addEventListener("innofaso:session-expired", handleExpired);
    return () => window.removeEventListener("innofaso:session-expired", handleExpired);
  }, []);

  const login = async (username, password) => {
    setLoginError("");
    try {
      const { token, user: u } = await authAPI.login(username, password);
      setToken(token);
      setUser(u);
      return true;
    } catch (err) {
      setLoginError(err.message || "Identifiant ou mot de passe incorrect.");
      return false;
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loginError, setLoginError, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
