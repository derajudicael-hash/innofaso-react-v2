import Icon from "./Icon";

export default function KpiCard({
  label, value, sub, iconName, iconClass, valueClass, delay,
  onIconClick, trend, trendIsGood, cardCls,
}) {
  const trendFlat = trend === undefined || trend === null || trend === 0;
  const trendUp   = !trendFlat && trend > 0;
  const trendGood = trendFlat ? null : (trendIsGood ? trendUp : !trendUp);

  return (
    <div className={`kpi-card${cardCls ? " " + cardCls : ""}`} style={{ animationDelay: delay }}>
      <div className="kpi-header">
        <div className="kpi-label">{label}</div>
        <button
          className={`kpi-icon ${iconClass} kpi-icon-btn`}
          onClick={onIconClick}
          title="Voir les détails"
        >
          <Icon name={iconName} size={17} strokeWidth={2.5} />
        </button>
      </div>

      <div className={`kpi-value ${valueClass}`}>{value}</div>

      <div className="kpi-footer">
        <div className="kpi-sub">{sub}</div>
        {!trendFlat && (
          <div className={`kpi-trend ${trendGood ? "trend-good" : "trend-bad"}`}>
            <Icon name={trendUp ? "arrow-up" : "arrow-down"} size={10} strokeWidth={2.5} />
            {Math.abs(trend)} J-1
          </div>
        )}
      </div>
    </div>
  );
}
