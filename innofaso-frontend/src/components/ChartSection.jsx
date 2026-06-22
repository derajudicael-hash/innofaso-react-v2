import { useState, useEffect } from "react";
import { usePointHistory } from "../hooks/usePointHistory";
import TrendChart from "./TrendChart";

// Courbe réelle par point de prélèvement (mêmes données que la page
// Historique), avec cases à cocher pour choisir quelles courbes afficher.
// Volontairement sans boutons d'export : les exports restent centralisés
// dans Historique pour ne pas dupliquer ce contrôle entre les deux pages.
export default function ChartSection({ zone }) {
  const { series, loading } = usePointHistory(zone?.mapId);

  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  useEffect(() => { setHiddenIds(new Set()); }, [zone?.mapId]);
  const togglePoint = (pointId) => setHiddenIds((prev) => {
    const next = new Set(prev);
    if (next.has(pointId)) next.delete(pointId); else next.add(pointId);
    return next;
  });
  const visibleSeries = series.filter((s) => !hiddenIds.has(s.pointId));
  const seuil = zone?.worstSeuil ?? zone?.seuil ?? 50;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title">Évolution – {zone.label}</div>
      </div>

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

      <div className="chart-wrap">
        {loading ? (
          <div className="dash-loading"><div className="spinner" /></div>
        ) : (
          <TrendChart series={visibleSeries} seuil={seuil} />
        )}
      </div>
    </div>
  );
}
