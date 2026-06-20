// Palette de couleurs distinctes pour les courbes par point (Historique).
// La couleur encode l'IDENTITÉ du point (pas son statut) — le dépassement de
// seuil reste visible via la ligne de seuil pointillée + l'info-bulle.
export const POINT_COLOR_PALETTE = [
  "#1a6fa3", "#e0833a", "#2f9e58", "#a23b9e", "#c0392b", "#1abc9c", "#8e6b1f", "#3457d5",
  "#b8860b", "#7d3c98", "#16a085", "#cb4154", "#5d8aa8", "#9b59b6", "#27ae60", "#e67e22",
  "#34495e", "#c2185b", "#0097a7", "#f39c12",
];

// Assigne une couleur stable à chaque point d'une zone : on trie les IDs pour
// que l'attribution ne dépende pas de l'ordre d'arrivée des données, ce qui
// garantit aussi l'absence de doublon de couleur dans une même zone tant
// qu'elle a ≤ 20 points fixes (le maximum actuel, Conditionnement, en a ~19).
export function assignPointColors(pointIds) {
  const sorted = [...pointIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const map = new Map();
  sorted.forEach((id, i) => map.set(id, POINT_COLOR_PALETTE[i % POINT_COLOR_PALETTE.length]));
  return map;
}
