"use client";

import { useMapStore } from "../store/mapStore";
import { ZONES } from "../data/zones";

export default function Topbar() {
  const { selectedZoneId, selectZone } = useMapStore();
  const zone = selectedZoneId ? ZONES.find((z) => z.id === selectedZoneId) : null;

  return (
    <header className="flex items-center gap-2.5 px-4 py-2.5 bg-white border-b border-gray-100 flex-shrink-0">
      {zone && (
        <button
          onClick={() => selectZone(null)}
          className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Retour
        </button>
      )}
      <h1 className="text-[14px] font-medium text-gray-800">
        {zone
          ? `${zone.label}${zone.sub ? ` — ${zone.sub}` : ""}`
          : "Plan de l'usine — Points de prélèvement"}
      </h1>
    </header>
  );
}
