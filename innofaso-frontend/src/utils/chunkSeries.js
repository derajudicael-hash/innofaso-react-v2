// Découpe une liste de séries (courbes) en groupes de taille max `size` —
// au-delà de 5 courbes superposées sur un même graphique, les couleurs se
// confondent visuellement. Une zone à 12 points produit ainsi 3 graphiques
// empilés de 5/5/2 plutôt qu'un seul graphique surchargé et illisible.
export function chunkSeries(series, size = 5) {
  const chunks = [];
  for (let i = 0; i < series.length; i += size) chunks.push(series.slice(i, i + size));
  return chunks;
}
