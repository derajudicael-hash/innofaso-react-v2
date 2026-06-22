import { useState, useMemo, useEffect, useCallback } from "react";
import { useComputedZones, TYPE_SEUIL } from "../hooks/useComputedZones";
import { usePointHistory, buildSeriesFromRaw } from "../hooks/usePointHistory";
import { useAuth } from "../context/AuthContext";
import { labResultsAPI } from "../services/api.js";
import { exportHistoryToDocx } from "../utils/exportHistoryDocx.js";
import { exportHistoryToXlsx } from "../utils/exportHistoryXlsx.js";
import TrendChart from "../components/TrendChart";
import Icon from "../components/Icon";

function statusOf(ufc, seuil) {
  if (ufc >= seuil)        return "critical";
  if (ufc >= seuil * 0.8)  return "warning";
  return "ok";
}

const STATUS_LABEL = { critical: "Critique", warning: "Surveillance", ok: "Conforme" };

function fmtDateFull(d) {
  const dd = new Date(d);
  return `${String(dd.getDate()).padStart(2, "0")}/${String(dd.getMonth() + 1).padStart(2, "0")}/${dd.getFullYear()}`;
}

function StatBox({ label, value, unit, colorClass, tooltip }) {
  return (
    <div className="history-stat" title={tooltip}>
      <div className="history-stat-label">{label}</div>
      <div className={`history-stat-value${colorClass ? " " + colorClass : ""}`}>
        {value}
        {unit && <span className="hstat-unit"> {unit}</span>}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { computedZones: zones, loading } = useComputedZones();
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => {
    if (zones.length && !selectedId) setSelectedId(zones[0].id);
  }, [zones, selectedId]);
  const zone = useMemo(() => zones.find((z) => z.id === selectedId) || zones[0] || null, [zones, selectedId]);

  // Courbes par point (Phase 1) + points aléatoires distincts (Phase 2), réelles depuis le backend
  const { series, randomPoints, loading: histLoading, reload: reloadHistory } = usePointHistory(zone?.mapId);

  // Checkboxes de visibilité par point — toutes cochées par défaut, réinitialisées au changement de zone
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  useEffect(() => { setHiddenIds(new Set()); }, [zone?.mapId]);
  const togglePoint = (pointId) => setHiddenIds((prev) => {
    const next = new Set(prev);
    if (next.has(pointId)) next.delete(pointId); else next.add(pointId);
    return next;
  });
  const visibleSeries = useMemo(() => series.filter((s) => !hiddenIds.has(s.pointId)), [series, hiddenIds]);

  const seuil = zone?.worstSeuil ?? zone?.seuil ?? 50;

  // Tous les relevés réels de la zone (tous points confondus), triés chronologiquement
  const allPointsFlat = useMemo(() => {
    return series
      .flatMap((s) => (s.points || []).map((p) => ({
        ...p, pointId: s.pointId, label: s.label,
        seuil: TYPE_SEUIL[s.pointType] ?? seuil,
      })))
      .filter((p) => p.ufc !== null && p.ufc !== undefined)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [series, seuil]);

  const stats = useMemo(() => {
    if (!allPointsFlat.length) return null;
    const values = allPointsFlat.map((p) => p.ufc);
    const avg    = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    const max    = Math.max(...values);
    const min    = Math.min(...values);
    const trend  = values.length >= 2 ? values[values.length - 1] - values[0] : 0;
    return { avg, max, min, trend };
  }, [allPointsFlat]);

  // ── Journal des imports (annulation superadmin) ─────────────
  const [imports, setImports] = useState([]);
  const [importsLoading, setImportsLoading] = useState(false);

  const loadImports = useCallback(async () => {
    setImportsLoading(true);
    try {
      setImports(await labResultsAPI.listImports());
    } catch (err) {
      console.error("Erreur chargement journal des imports:", err);
    } finally {
      setImportsLoading(false);
    }
  }, []);
  useEffect(() => { loadImports(); }, [loadImports]);

  const handleUndo = async (importId) => {
    if (!window.confirm(
      "Annuler cet import ? Les valeurs seront restaurées à leur état précédent, sauf pour les points qu'un import plus récent a déjà légitimement modifiés."
    )) return;
    try {
      await labResultsAPI.undoImport(importId);
      await Promise.all([loadImports(), reloadHistory()]);
    } catch (err) {
      alert(err.message || "Erreur lors de l'annulation de l'import.");
    }
  };

  const handleDelete = async (importId) => {
    if (!window.confirm(
      "Supprimer complètement cet import ? Contrairement à l'annulation, cette action efface aussi l'historique réel de cet import — c'est comme si ce bulletin n'avait jamais été importé. Aucune restauration possible ensuite."
    )) return;
    try {
      await labResultsAPI.deleteImport(importId);
      await Promise.all([loadImports(), reloadHistory()]);
    } catch (err) {
      alert(err.message || "Erreur lors de la suppression de l'import.");
    }
  };

  // ── Bandeau de rétention 30 jours (Phase 3) ─────────────────
  const [retention, setRetention] = useState(null);
  useEffect(() => {
    labResultsAPI.getRetentionStatus().then(setRetention).catch(() => setRetention(null));
  }, [series, imports]);

  // ── Exports ──────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!zone || !allPointsFlat.length) return;
    const headers = ["Date", "Point", "UFC/cm²", "Seuil", "Statut", "Marge", "Salmonelles", "Cronobacter"];
    const rows = allPointsFlat.map((h) => {
      const st    = statusOf(h.ufc, h.seuil);
      const marge = h.seuil - h.ufc;
      return [
        fmtDateFull(h.date), h.pointId, h.ufc, h.seuil, STATUS_LABEL[st], (marge > 0 ? "+" : "") + marge,
        h.salmonella === true ? "Détectées" : h.salmonella === false ? "Absentes" : "—",
        h.cronobacter === true ? "Détecté" : h.cronobacter === false ? "Absent" : "—",
      ];
    });
    const csv  = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `innofaso_${zone.label.replace(/\s+/g, "_")}_historique.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [exporting, setExporting] = useState(false);

  const buildAllZonesData = async () => {
    const zonesData = [];
    for (const z of zones) {
      const raw = await labResultsAPI.getPointHistory(z.mapId);
      const { series: s, randomPoints: rp } = buildSeriesFromRaw(raw);
      zonesData.push({ zone: { label: z.label }, series: s, randomPoints: rp, seuil: z.worstSeuil ?? z.seuil ?? 50 });
    }
    return zonesData;
  };

  const handleExportWord = async () => {
    setExporting(true);
    try {
      await exportHistoryToDocx(await buildAllZonesData());
    } catch (err) {
      console.error("Erreur export Word:", err);
      alert("Erreur lors de la génération du rapport Word.");
    } finally {
      setExporting(false);
    }
  };

  const [exportingXlsx, setExportingXlsx] = useState(false);
  const handleExportExcel = async () => {
    setExportingXlsx(true);
    try {
      await exportHistoryToXlsx(await buildAllZonesData());
    } catch (err) {
      console.error("Erreur export Excel:", err);
      alert("Erreur lors de la génération du rapport Excel.");
    } finally {
      setExportingXlsx(false);
    }
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
          <div className="page-sub">
            Courbe réelle par point de prélèvement (entérobactéries), fenêtre glissante (cf. bandeau de rétention)
          </div>
        </div>
        <div className="history-export-group">
          <button className="history-export-btn" onClick={handleExportCSV} disabled={!zone || !allPointsFlat.length}>
            <Icon name="download" size={14} strokeWidth={2} />
            CSV (zone)
          </button>
          <button className="history-export-btn" onClick={handleExportWord} disabled={exporting}>
            <Icon name="download" size={14} strokeWidth={2} />
            {exporting ? "Export en cours…" : "Export Word (toutes zones)"}
          </button>
          <button className="history-export-btn" onClick={handleExportExcel} disabled={exportingXlsx}>
            <Icon name="download" size={14} strokeWidth={2} />
            {exportingXlsx ? "Export en cours…" : "Export Excel (toutes zones)"}
          </button>
        </div>
      </div>

      {retention && retention.daysUntilDrop !== null && retention.needsExportSoon && (
        <div className={`history-retention-banner${retention.daysUntilDrop <= 2 ? " urgent" : ""}`}>
          <span>
            ⏳ {retention.daysUntilDrop <= 0
              ? "Des relevés sortent dès maintenant de la fenêtre de rétention."
              : `Les relevés les plus anciens seront retirés de l'historique dans ${retention.daysUntilDrop} jour${retention.daysUntilDrop > 1 ? "s" : ""}.`}
            {" "}Exportez le rapport avant cette échéance.
          </span>
          <button className="history-export-btn" onClick={handleExportWord} disabled={exporting}>
            {exporting ? "Export en cours…" : "Exporter maintenant"}
          </button>
        </div>
      )}

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
      </div>

      {!zone ? (
        <div className="dash-loading">Aucune zone disponible.</div>
      ) : histLoading ? (
        <div className="dash-loading"><div className="spinner" />Chargement…</div>
      ) : series.length === 0 && randomPoints.length === 0 ? (
        <div className="panel" style={{ padding: "44px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--txt)", marginBottom: 8 }}>
            Aucun relevé pour « {zone.label} » sur les 30 derniers jours
          </div>
          <div style={{ fontSize: 12.5, color: "var(--txt3)", lineHeight: 1.7, maxWidth: 460, margin: "0 auto" }}>
            L'historique affiche uniquement les vraies données issues des bulletins d'analyse
            importés depuis la Cartographie. Importez un bulletin couvrant un ou plusieurs points
            de cette zone pour voir apparaître son évolution ici.
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="history-stats">
            <StatBox
              label="Moyenne"
              value={stats?.avg ?? "—"}
              unit="UFC/cm²"
              colorClass={stats?.avg >= seuil ? "red" : stats?.avg >= seuil * 0.8 ? "orange" : ""}
              tooltip="Moyenne de tous les relevés de cette zone sur la période affichée : donne le niveau de contamination habituel, sans qu'un seul pic isolé ne fausse la lecture."
            />
            <StatBox
              label="Maximum"
              value={stats?.max ?? "—"}
              unit="UFC/cm²"
              colorClass={stats?.max >= seuil ? "red" : ""}
              tooltip="La pire valeur relevée sur la période : le moment où cette zone était la plus contaminée."
            />
            <StatBox
              label="Minimum"
              value={stats?.min ?? "—"}
              unit="UFC/cm²"
              colorClass=""
              tooltip="La meilleure valeur relevée sur la période : le moment où cette zone était la plus propre."
            />
            <StatBox
              label="Tendance"
              value={stats
                ? (stats.trend > 0 ? "+" : stats.trend < 0 ? "-" : "") + Math.abs(stats.trend)
                : "—"}
              unit="UFC/cm²"
              colorClass={stats?.trend > 0 ? "red" : stats?.trend < 0 ? "green" : ""}
              tooltip="Différence entre le dernier relevé et le premier relevé de la période. Un nombre positif (+) veut dire que la contamination augmente ; un nombre négatif (-) veut dire qu'elle diminue."
            />
          </div>

          {/* Graphique multi-points */}
          <div className="panel history-chart-panel">
            <div className="panel-header">{zone.label} — Évolution UFC/cm² par point</div>
            {series.length > 0 && (
              <div className="history-legend">
                {series.map((s) => (
                  <label key={s.pointId} className="history-legend-item">
                    <input
                      type="checkbox"
                      checked={!hiddenIds.has(s.pointId)}
                      onChange={() => togglePoint(s.pointId)}
                    />
                    <span className="history-legend-swatch" style={{ background: s.color }} />
                    {s.pointId}
                  </label>
                ))}
              </div>
            )}
            <div className="history-chart-wrap">
              <TrendChart series={visibleSeries} seuil={seuil} />
            </div>
          </div>

          {/* Points aléatoires — affichage distinct, jamais de courbe */}
          {randomPoints.length > 0 && (
            <div className="panel history-random-panel">
              <div className="history-random-panel-title">
                Points aléatoires mesurés sur cette période ({randomPoints.length})
              </div>
              <div className="history-random-chips">
                {randomPoints.map((rp) => {
                  const last      = rp.series[rp.series.length - 1];
                  const hasSalmo  = rp.series.some((s) => s.salmonella === true);
                  const hasCrono  = rp.series.some((s) => s.cronobacter === true);
                  return (
                    <span key={rp.pointId} className={`history-random-chip${(hasSalmo || hasCrono) ? " has-salmonella" : ""}`}>
                      <span className="hrc-id">{rp.pointId}</span>
                      {last ? `${last.ufc} UFC/cm² · ${fmtDateFull(last.date)}` : "—"}
                      {hasSalmo && " · ⚠ Salmonelles"}
                      {hasCrono && " · ⚠ Cronobacter"}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tableau détaillé */}
          <div className="panel">
            <div className="panel-header">
              Relevés ({allPointsFlat.length})
              <span className="panel-header-sub">Seuil : {seuil} UFC/cm²</span>
            </div>
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Point</th>
                    <th>UFC/cm²</th>
                    <th>Seuil</th>
                    <th>Statut</th>
                    <th>Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {allPointsFlat.slice().reverse().map((h, i) => {
                    const st    = statusOf(h.ufc, h.seuil);
                    const marge = h.seuil - h.ufc;
                    return (
                      <tr key={`${h.pointId}-${h.date}-${i}`} className={i % 2 === 0 ? "row-even" : ""}>
                        <td className="td-date">{fmtDateFull(h.date)}</td>
                        <td className="mono txt3">{h.pointId}</td>
                        <td className={`mono ${st === "critical" ? "red" : st === "warning" ? "orange" : ""}`}>
                          {h.ufc}
                        </td>
                        <td className="mono txt3">{h.seuil}</td>
                        <td><span className={`status-badge ${st}`}>{STATUS_LABEL[st]}</span></td>
                        <td className={`mono ${marge < 0 ? "red" : marge < h.seuil * 0.2 ? "orange" : "green"}`}>
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
      )}

      {/* Journal des imports */}
      <div className="panel">
        <div className="panel-header">
          Journal des imports{importsLoading ? " — chargement…" : ""}
        </div>
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Fichier</th>
                <th>Par</th>
                <th>Résultats</th>
                <th>Statut</th>
                {isSuperadmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {imports.map((imp, i) => (
                <tr
                  key={imp.id}
                  className={`${i % 2 === 0 ? "row-even" : ""}${imp.status === "annule" ? " history-imports-row cancelled" : ""}`}
                >
                  <td className="td-date">{fmtDateFull(imp.imported_at)}</td>
                  <td>{imp.filename}</td>
                  <td className="txt3">{imp.imported_by}</td>
                  <td className="mono txt3">{imp.result_count}</td>
                  <td>
                    {imp.status === "annule"
                      ? <span className="status-badge critical">Annulé{imp.cancelled_by ? ` · ${imp.cancelled_by}` : ""}</span>
                      : <span className="status-badge ok">Actif</span>}
                  </td>
                  {isSuperadmin && (
                    <td>
                      {imp.status !== "annule" ? (
                        <button className="history-undo-btn" onClick={() => handleUndo(imp.id)}>
                          Annuler cet import
                        </button>
                      ) : (
                        <button className="history-undo-btn history-delete-btn" onClick={() => handleDelete(imp.id)}>
                          Supprimer complètement
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {imports.length === 0 && !importsLoading && (
                <tr>
                  <td colSpan={isSuperadmin ? 6 : 5} className="txt3" style={{ textAlign: "center", padding: 20 }}>
                    Aucun import enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
