import { useState, useEffect } from "react";
import "./App.css";
import "./admin.css";

import Sidebar       from "./components/Sidebar";
import Topbar        from "./components/Topbar";
import AlertsPage    from "./components/AlertsPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage   from "./pages/HistoryPage";
import SettingsPage  from "./pages/SettingsPage";

import { AuthProvider, useAuth }           from "./context/AuthContext";
import { AdminDataProvider }               from "./context/AdminDataContext";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";

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
    case "alerts":    return <AlertsPage />;
    case "admin":     return <AdminPage />;
    case "history":   return <HistoryPage />;
    case "settings":  return <SettingsPage />;
    default:          return <DashboardPage />;
  }
}

function InnerApp() {
  const { user } = useAuth();
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

  if (showLogin && !user) {
    return <LoginPage onBack={() => setShowLogin(false)} />;
  }

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
          {activeNav === "carto" ? (
            <iframe
              src="http://localhost:3000"
              title="Cartographie InnoFaso"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <div className="scroll-area">
              <Router activeNav={activeNav} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AdminDataProvider>
        <InnerApp />
      </AdminDataProvider>
    </AuthProvider>
  );
}
