"use client";

import { create } from "zustand";
import type { ContaminationLevel } from "../types";
import { ZONES } from "../data/zones";

interface MapStore {
  /** Per-zone contamination level overrides (starts from zone default) */
  zoneColors: Record<string, ContaminationLevel>;
  /** Currently selected zone id, or null */
  selectedZoneId: string | null;
  /** Current animated SVG viewBox string */
  viewBox: string;

  setZoneColor: (zoneId: string, level: ContaminationLevel) => void;
  selectZone: (zoneId: string | null) => void;
  setViewBox: (vb: string) => void;
}

const initialColors = Object.fromEntries(
  ZONES.map((z) => [z.id, z.color])
) as Record<string, ContaminationLevel>;

export const useMapStore = create<MapStore>((set) => ({
  zoneColors: initialColors,
  selectedZoneId: null,
  viewBox: "0 0 1050 510",

  setZoneColor: (zoneId, level) =>
    set((s) => ({ zoneColors: { ...s.zoneColors, [zoneId]: level } })),

  selectZone: (zoneId) => set({ selectedZoneId: zoneId }),

  setViewBox: (vb) => set({ viewBox: vb }),
}));
