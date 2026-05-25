"use client";

import { ZONES } from "../data/zones";
import { SAMPLING_POINTS } from "../data/zones";
import {
  CONTAMINATION_COLORS,
  ENV_LABELS,
  ENV_BADGE_STYLE,
  type ContaminationLevel,
} from "../types";
import { useMapStore } from "../store/mapStore";

const MINI_SCALE = 0.22;

function ptPos(
  zone: { x: number; y: number; w: number; h: number },
  index: number,
  total: number
) {
  const cols = Math.min(total, 2);
  return {
    cx: zone.x + zone.w * 0.3 + (index % cols) * (zone.w * 0.35),
    cy: zone.y + zone.h * 0.62 + Math.floor(index / cols) * 16,
  };
}

function MiniMap({ selectedId }: { selectedId: string }) {
  const { zoneColors } = useMapStore();
  const vw = (1050 * MINI_SCALE).toFixed(0);
  const vh = (510 * MINI_SCALE).toFixed(0);

  return (
    <div className="mb-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      <p className="text-[10px] text-gray-400 px-2 pt-1.5 pb-0.5">Localisation</p>
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        width="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        {ZONES.map((zo) => {
          const isSel = zo.id === selectedId;
          const level = zoneColors[zo.id] ?? zo.color;
          const pal = CONTAMINATION_COLORS[level];
          return (
            <g key={zo.id}>
              <rect
                x={zo.x * MINI_SCALE}
                y={zo.y * MINI_SCALE}
                width={zo.w * MINI_SCALE}
                height={zo.h * MINI_SCALE}
                fill={isSel ? pal.fill : pal.fill + "55"}
                stroke={isSel ? pal.stroke : "#ccc"}
                strokeWidth={isSel ? 2 : 0.5}
                rx={2}
              />
              {isSel &&
                zo.pointIds.map((_, i) => {
                  const pos = ptPos(zo, i, zo.pointIds.length);
                  return (
                    <circle
                      key={i}
                      cx={pos.cx * MINI_SCALE}
                      cy={pos.cy * MINI_SCALE}
                      r={3}
                      fill="#E24B4A"
                    />
                  );
                })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ColorPills({ zoneId }: { zoneId: string }) {
  const { zoneColors, setZoneColor } = useMapStore();
  const current = zoneColors[zoneId] ?? "green";

  return (
    <div className="mb-3 pb-3 border-b border-gray-100">
      <p className="text-[11px] font-medium text-gray-400 mb-2">
        Niveau de contamination
      </p>
      <div className="flex gap-4">
        {(Object.entries(CONTAMINATION_COLORS) as [ContaminationLevel, (typeof CONTAMINATION_COLORS)[ContaminationLevel]][]).map(
          ([key, pal]) => (
            <button
              key={key}
              onClick={() => setZoneColor(zoneId, key)}
              className="flex flex-col items-center gap-1"
            >
              <span
                className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{
                  background: pal.fill,
                  border: `2.5px solid ${current === key ? pal.text : "transparent"}`,
                  boxShadow: current === key ? `0 0 0 1px ${pal.stroke}` : "none",
                }}
              />
              <span
                className="text-[10px]"
                style={{
                  color: current === key ? pal.text : "#9ca3af",
                  fontWeight: current === key ? 500 : 400,
                }}
              >
                {pal.label}
              </span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function ZoneSidebar() {
  const { selectedZoneId, zoneColors } = useMapStore();
  const zone = selectedZoneId ? ZONES.find((z) => z.id === selectedZoneId) : null;
  const headerPal = zone
    ? CONTAMINATION_COLORS[zoneColors[zone.id] ?? zone.color]
    : null;

  return (
    <aside
      className="flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out bg-white border-l border-gray-100"
      style={{ width: zone ? 290 : 0 }}
    >
      {zone && (
        <div className="w-[290px] h-full overflow-y-auto p-3.5">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3.5">
            {headerPal && (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-medium flex-shrink-0"
                style={{
                  background: headerPal.fill,
                  border: `1.5px solid ${headerPal.stroke}`,
                  color: headerPal.text,
                }}
              >
                {zone.num}
              </div>
            )}
            <div>
              <p className="text-[13px] font-medium text-gray-900 leading-snug">
                {zone.label}
              </p>
              <p className="text-[11px] text-gray-400">
                {zone.sub || "—"} · {zone.pointIds.length} point(s)
              </p>
            </div>
          </div>

          <ColorPills zoneId={zone.id} />
          <MiniMap selectedId={zone.id} />

          {/* Sampling points */}
          <p className="text-[11px] font-medium text-gray-400 mb-2">
            Points de prélèvement
          </p>

          {zone.pointIds.length === 0 ? (
            <p className="text-[12px] text-gray-400 text-center py-5">
              Aucun point défini pour cette zone.
            </p>
          ) : (
            zone.pointIds.map((ptId) => {
              const pt = SAMPLING_POINTS[ptId];
              if (!pt) return null;
              return (
                <div
                  key={ptId}
                  className="bg-gray-50 rounded-lg p-2.5 mb-2"
                >
                  <p className="text-[10px] font-medium text-red-500 mb-0.5">
                    {ptId}
                  </p>
                  <p className="text-[11px] text-gray-800 mb-1.5 leading-snug">
                    {pt.name}
                  </p>
                  <span
                    className="inline-block text-[10px] px-1.5 py-0.5 rounded mb-1.5"
                    style={ENV_BADGE_STYLE[pt.env]}
                  >
                    {ENV_LABELS[pt.env]}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: "#eff6ff", color: "#1e40af" }}
                    >
                      Entéro: {pt.entero}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: "#f0fdf4", color: "#166534" }}
                    >
                      Salmo: {pt.salmo}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
}
