import { useState, useMemo, useEffect } from "react";
import { useAdminData } from "../context/AdminDataContext";
import TrendChart from "../components/TrendChart";
import Icon from "../components/Icon";

const TABS = ["7j", "30j", "90j"];

function statusOf(ufc, seuil) {
  if (ufc >= seuil)        return "critical";
  if (ufc >= seuil * 0.8)  return "warning";
  return "ok";
}

const STATUS_LABEL = { critical: "Critique", warning: "Surveillance", ok: "Conforme" };

// Génère un label "JJ/MM" pour une date passée de N jours
function dateLabel(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function StatBox({ label, value, unit, colorClass }) {
  return (
    <div className="history-stat">
      <div className="history-stat-label">{label}</div>
      <div className={`history-stat-value${colorClass ? " " + colorClass : ""}`}>
        {value}
        {unit && <span className="hstat-unit"> {unit}</span>}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { zones, loading } = useAdminData();
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("7j");

  useEffect(() => {
    if (zones.length && !selectedId) setSelectedId(zones[0].id);
  }, [zones, selectedId]);

  const zone    = useMemo(() => zones.find((z) => z.id === selectedId) || zones[0] || null, [zones, selectedId]);
  const history = zone?.history || [];
  const seuil   = zone?.seuil ?? 50;

  // Dates réelles pour chaque relevé (aujourd'hui - N jours)
  const dateLabels = useMemo(() =>
    history.map((_, i) => dateLabel(history.length - 1 - i)),
    [history]
  );

  const stats = useMemo(() => {
    if (!history.length) return null;
    const avg   = Math.round(history.reduce((s, v) => s + v, 0) / history.length);
    const max   = Math.max(...history);
    const min   = Math.min(...history);
    const trend = history.length >= 2 ? history[history.length - 1] - history[0] : 0;
    return { avg, max, min, trend };
  }, [history]);

  const handleExportCSV = () => {
    if (!zone || !history.length) return;
    const headers = ["Date", "UFC/cm²", "Seuil", "Statut", "Marge"];
    const rows = history.map((ufc, i) => {
      const st    = statusOf(ufc, seuil);
      const marge = seuil - ufc;
      return [dateLabels[i], ufc, seuil, STATUS_LABEL[st], (marge > 0 ? "+" : "") + marge];
    });
    const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `innofaso_${zone.label.replace(/\s+/g, "_")}_${dateLabel(0).replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="dash-loading">
      <div className="spinner" />
      Chargement de l'historique…
    </div>
  );

  return (
    <div className="history-page">
      <div className="history-page-header">
        <div>
          <div className="page-title">Historique des contrôles</div>
          <div className="page-sub">Évolution des niveaux UFC/cm² par zone · {history.length} derniers relevés</div>
        </div>
        <button className="history-export-btn" onClick={handleExportCSV} disabled={!zone || !history.length}>
          <Icon name="download" size={14} strokeWidth={2} />
          Exporter CSV
        </button>
      </div>

      {/* Sélecteur + Onglets */}
      <div className="history-controls">
        <select
          className="history-zone-select"
          value={zone?.id || ""}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="" disabled>— Sélectionner une zone —</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.label}</option>
          ))}
        </select>

        <div className="tab-group">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab-btn${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {zone ? (
        <>
          {/* Stats */}
          <div className="history-stats">
            <StatBox
              label="Moyenne"
              value={stats?.avg ?? "—"}
              unit="UFC/cm²"
              colorClass={stats?.avg >= seuil ? "red" : stats?.avg >= seuil * 0.8 ? "orange" : ""}
            />
            <StatBox
              label="Maximum"
              value={stats?.max ?? "—"}
              unit="UFC/cm²"
              colorClass={stats?.max >= seuil ? "red" : ""}
            />
            <StatBox
              label="Minimum"
              value={stats?.min ?? "—"}
              unit="UFC/cm²"
              colorClass=""
            />
            <StatBox
              label="Tendance"
              value={stats
                ? (stats.trend > 0 ? "↑ +" : stats.trend < 0 ? "↓ " : "→ ") + Math.abs(stats.trend)
                : "—"}
              unit="UFC/cm²"
              colorClass={stats?.trend > 0 ? "red" : stats?.trend < 0 ? "green" : ""}
            />
          </div>

          {/* Graphique */}
          <div className="panel history-chart-panel">
            <div className="panel-header">{zone.label} — Évolution UFC/cm²</div>
            <div className="history-chart-wrap">
              <TrendChart history={history} tab={tab} seuil={seuil} />
            </div>
          </div>

          {/* Tableau */}
          <div className="panel">
            <div className="panel-header">
              Relevés disponibles ({history.length})
              <span className="panel-header-sub">Seuil : {seuil} UFC/cm²</span>
            </div>
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>UFC/cm²</th>
                    <th>Seuil</th>
                    <th>Statut</th>
                    <th>Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((ufc, i) => {
                    const st    = statusOf(ufc, seuil);
                    const marge = seuil - ufc;
                    return (
                      <tr key={i} className={i % 2 === 0 ? "row-even" : ""}>
                        <td className="td-date">{dateLabels[i]}</td>
                        <td className={`mono ${st === "critical" ? "red" : st === "warning" ? "orange" : ""}`}>
                          {ufc}
                        </td>
                        <td className="mono txt3">{seuil}</td>
                        <td><span className={`status-badge ${st}`}>{STATUS_LABEL[st]}</span></td>
                        <td className={`mono ${marge < 0 ? "red" : marge < seuil * 0.2 ? "orange" : "green"}`}>
                          {marge > 0 ? "+" : ""}{marge}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="dash-loading">Aucune zone disponible.</div>
      )}
    </div>
  );
}
