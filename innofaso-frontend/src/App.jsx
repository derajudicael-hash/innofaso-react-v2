import { useState, useEffect } from "react";
import "./App.css";
import "./admin.css";

import Sidebar       from "./components/Sidebar";
import Topbar        from "./components/Topbar";
import AlertsPage    from "./components/AlertsPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage   from "./pages/HistoryPage";
import SettingsPage  from "./pages/SettingsPage";
import CartoPage     from "./pages/CartoPage";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminDataProvider }     from "./context/AdminDataContext";
import { ThemeProvider }         from "./context/ThemeContext";
import { PointsProvider }        from "./context/PointsContext";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import AIReportsPage from "./pages/AIReportsPage";

function useClock() {
  const [clock, setClock] = useState("");
  useEffect(() => {
    const fmt = () => {
      const now  = new Date();
      const date = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
      const time = now.toTimeString().slice(0, 5);
      setClock(`${date} · ${time}`);
    };
    fmt();
    const iv = setInterval(fmt, 30_000);
    return () => clearInterval(iv);
  }, []);
  return clock;
}

function Router({ activeNav }) {
  switch (activeNav) {
    case "dashboard": return <DashboardPage />;
    case "carto":     return <CartoPage />;
    case "alerts":    return <AlertsPage />;
    case "admin":     return <AdminPage />;
    case "history":   return <HistoryPage />;
    case "rapport":   return <AIReportsPage />;
    case "settings":  return <SettingsPage />;
    default:          return <DashboardPage />;
  }
}

function InnerApp() {
  const { user, loading } = useAuth();
  const clock    = useClock();
  const [activeNav, setActiveNav] = useState("dashboard");
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (user) { setActiveNav("admin"); setShowLogin(false); }
  }, [user]);

  const handleAdminClick = () => {
    if (user) setActiveNav("admin");
    else      setShowLogin(true);
  };

  useEffect(() => {
    const handler = (e) => setActiveNav(e.detail?.to || "admin");
    window.addEventListener("innofaso:navigate", handler);
    return () => window.removeEventListener("innofaso:navigate", handler);
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px', color: '#64748b' }}>Chargement...</div>;
  }

  if (showLogin && !user) {
    return <LoginPage onBack={() => setShowLogin(false)} />;
  }

  const isCarto = activeNav === "carto";

  return (
    <div className="app-root">
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onAdminClick={handleAdminClick}
        isAdminLoggedIn={!!user}
      />
      <div className="main-area">
        <Topbar clock={clock} activeNav={activeNav} />
        <main className="main-content">
          <div className={`scroll-area${isCarto ? " scroll-area--map" : ""}`}>
            <Router activeNav={activeNav} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AdminDataProvider>
          <PointsProvider>
            <InnerApp />
          </PointsProvider>
        </AdminDataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
