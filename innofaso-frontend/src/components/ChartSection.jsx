import TrendChart from "./TrendChart";

const TABS = ["7j", "30j", "90j"];

export default function ChartSection({ zone, tab, setTab }) {
  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title">Évolution – {zone.label}</div>

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

      <div className="chart-wrap">
        <TrendChart history={zone.history} tab={tab} seuil={zone.seuil} />
      </div>
    </div>
  );
}
