// src/context/AuthContext.jsx  — VERSION BACKEND
import { createContext, useContext, useState, useEffect } from "react";
import { authAPI, getToken, setToken, removeToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,       setUser]       = useState(null);
  const [loginError, setLoginError] = useState("");
  const [loading,    setLoading]    = useState(true); // check saved token on mount

  // Restore session from localStorage on app start
  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        // Decode payload (no verify — server will reject if expired)
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
