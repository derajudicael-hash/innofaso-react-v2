export type ContaminationLevel = "green" | "orange" | "red";

export interface ColorPalette {
  fill: string;
  stroke: string;
  text: string;
  label: string;
}

export const CONTAMINATION_COLORS: Record<ContaminationLevel, ColorPalette> = {
  green: {
    fill:   "#b7e4a0",
    stroke: "#7abf62",
    text:   "#2d6e14",
    label:  "Faible",
  },
  orange: {
    fill:   "#fdd9a0",
    stroke: "#e8a430",
    text:   "#7a4a00",
    label:  "Modérée",
  },
  red: {
    fill:   "#f7b3a8",
    stroke: "#e06050",
    text:   "#8b2218",
    label:  "Élevée",
  },
};

export interface SamplingPoint {
  id: string;
  name: string;
  env: 1 | 2 | 3 | 4;
  entero: string;
  salmo: string;
}

export interface Zone {
  id: string;
  num: number;
  label: string;
  sub: string;
  /** Default contamination level */
  color: ContaminationLevel;
  x: number;
  y: number;
  w: number;
  h: number;
  pointIds: string[];
}

export const ENV_LABELS: Record<number, string> = {
  1: "Env. 1 — Contact direct",
  2: "Env. 2 — Contact indirect",
  3: "Env. 3 — Non-contact",
  4: "Env. 4 — Zone périphérique",
};

/** Inline styles for env badges — avoids dynamic Tailwind class purging */
export const ENV_BADGE_STYLE: Record<number, { background: string; color: string }> = {
  1: { background: "#fef2f2", color: "#991b1b" },
  2: { background: "#fffbeb", color: "#78350f" },
  3: { background: "#f0fdf4", color: "#14532d" },
  4: { background: "#eff6ff", color: "#1e3a5f" },
};
