import { CONTAMINATION_COLORS } from "../types";

export default function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-white border-t border-gray-100 text-[11px] text-gray-500 flex-shrink-0">
      {(Object.entries(CONTAMINATION_COLORS) as [string, { fill: string; stroke: string; label: string }][]).map(
        ([key, pal]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: pal.fill, border: `1px solid ${pal.stroke}` }}
            />
            {pal.label} contamination
          </div>
        )
      )}
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" />
        Point de prélèvement
      </div>
    </div>
  );
}
