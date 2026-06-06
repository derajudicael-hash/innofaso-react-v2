import { MAP_LEGEND } from "../data/zones";

// ─────────────────────────────────────────────
// ZONE TILE
// ─────────────────────────────────────────────
function ZoneTile({ zone, selected, onSelect }) {
  return (
    <div
      className={[
        "zone-tile",
        zone.status,
        selected ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect(zone.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(zone.id)}
    >
      {zone.status === "critical" && <div className="pulse-dot" />}
      <div className="zone-name">{zone.label}</div>
      <div className="zone-ufc">{zone.ufc} UFC/cm²</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FACTORY MAP
// ─────────────────────────────────────────────
export default function FactoryMap({ zones, selectedId, onSelect }) {
  return (
    <div className="panel map-panel">
      <div className="panel-header">Cartographie de l'usine</div>

      <div className="map-body">
        <div className="zone-grid">
          {zones.map((z) => (
            <ZoneTile
              key={z.id}
              zone={z}
              selected={selectedId === z.id}
              onSelect={onSelect}
            />
          ))}
        </div>

        <div className="map-legend">
          {MAP_LEGEND.map(({ color, label }) => (
            <div key={label} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
