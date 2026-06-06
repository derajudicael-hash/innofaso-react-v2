import { useState, useEffect } from "react";
import "./App.css";
import "./admin.css";   // ← ADD THIS LINE to your existing App.jsx

// Existing components (unchanged)
import Sidebar         from "./components/Sidebar";
import Topbar          from "./components/Topbar";
import AlertsPage      from "./components/AlertsPage";
import DashboardPage   from "./pages/DashboardPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import HistoryPage  from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";

// New admin imports
import { AuthProvider, useAuth }           from "./context/AuthContext";
import { AdminDataProvider, useAdminData } from "./context/AdminDataContext";
import LoginPage  from "./pages/LoginPage";
import AdminPage  from "./pages/AdminPage";
import CartoPage  from "./pages/CartoPage";

// ─────────────────────────────────────────────
// LIVE CLOCK HOOK (unchanged)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────
function Router({ activeNav }) {
  switch (activeNav) {
    case "dashboard": return <DashboardPage />;
    case "alerts":    return <AlertsPage />;
    case "admin":     return <AdminPage />;
    case "carto":     return <CartoPage />;
    case "history":   return <HistoryPage />;
    case "settings":  return <SettingsPage />;
    default:          return <DashboardPage />;
  }
}

// ─────────────────────────────────────────────
// INNER APP (has access to AuthContext)
// ─────────────────────────────────────────────
function InnerApp() {
  const { user } = useAuth();
  const clock    = useClock();
  const [activeNav,   setActiveNav]   = useState("dashboard");
  const [showLogin,   setShowLogin]   = useState(false);

  // When admin logs in → go straight to admin page
  useEffect(() => {
    if (user) { setActiveNav("admin"); setShowLogin(false); }
  }, [user]);

  // Clicking "Administration" in sidebar
  const handleAdminClick = () => {
    if (user) {
      setActiveNav("admin");
    } else {
      setShowLogin(true);
    }
  };

  // Show login page full-screen
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
          <div className="scroll-area">
            <Router activeNav={activeNav} />
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP — wraps everything in providers
// ─────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AdminDataProvider>
        <InnerApp />
      </AdminDataProvider>
    </AuthProvider>
  );
}
