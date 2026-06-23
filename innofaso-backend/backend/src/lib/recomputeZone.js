const db = require("../db");

// Même logique que routes/zones.js (PUT /:id) — dupliquée ici plutôt
// qu'importée pour éviter une dépendance circulaire (zones.js importe déjà
// recomputeZoneSeuil depuis ce module).
function computeStatus(ufc, seuil) {
  const s = Number(seuil) || 50;
  if (ufc >= s)       return "critical";
  if (ufc >= s * 0.8) return "warning";
  return "ok";
}

const ALERT_MAP = {
  critical: { alert_cls: "crit", alert_title: "Action requise",      alert_desc: "Niveau de contamination critique – Action immédiate requise" },
  warning:  { alert_cls: "warn", alert_title: "Surveillance requise", alert_desc: "Niveau proche du seuil – Surveiller l'évolution de près" },
  ok:       { alert_cls: "good", alert_title: "Zone conforme",        alert_desc: "Niveaux de contamination dans les limites acceptables" },
};

// Recalcule l'UFC max d'une zone à partir de ses points mesurés, journalise
// zone_history (purge 90 jours) et met à jour zones.ufc — utilisé après tout
// import, toute annulation d'import, ou tout placement d'un point en attente
// qui touche les points de cette zone.
//
// BUG corrigé (juin 2026) : seul zones.ufc était mis à jour ici. status/
// alert_cls/alert_title/alert_desc ne suivaient que via PUT /api/zones/:id
// (édition manuelle) — après un import automatique, une zone pouvait donc
// dépasser son seuil (ufc > seuil) tout en restant affichée "ok"/verte côté
// API brute. Le frontend (useComputedZones) recalculait déjà le bon statut
// à l'affichage, ce qui masquait le problème sur les pages qui passent par
// ce hook, mais la donnée stockée elle-même restait fausse.
async function recomputeZone(zoneMapId) {
  const [[zoneRow]] = await db.query("SELECT id, seuil FROM zones WHERE map_id = ?", [zoneMapId]);
  if (!zoneRow) return;

  const [pts] = await db.query(
    "SELECT ufc FROM sampling_points WHERE zone_map_id = ? AND ufc IS NOT NULL",
    [zoneMapId]
  );
  const maxUfc = pts.length > 0 ? Math.max(...pts.map(p => Number(p.ufc))) : 0;
  const status = computeStatus(maxUfc, zoneRow.seuil);
  const alert  = ALERT_MAP[status];

  await db.query("INSERT INTO zone_history (zone_id, ufc) VALUES (?, ?)", [zoneRow.id, maxUfc]);
  await db.query(
    "DELETE FROM zone_history WHERE zone_id = ? AND recorded_at < DATE_SUB(NOW(), INTERVAL 90 DAY)",
    [zoneRow.id]
  );
  await db.query(
    "UPDATE zones SET ufc = ?, status = ?, alert_cls = ?, alert_title = ?, alert_desc = ? WHERE id = ?",
    [maxUfc, status, alert.alert_cls, alert.alert_title, alert.alert_desc, zoneRow.id]
  );
}

// ─────────────────────────────────────────────
// Recalcule le seuil d'une zone à partir du seuil le plus strict (minimum)
// parmi ses points — alimenté à l'import par la colonne "Spécifications" du
// bulletin (cf. labResults.js). Ne touche jamais une zone dont l'admin a fixé
// le seuil à la main (zones.seuil_manual) : le bulletin n'est alors plus
// maître sur cette zone jusqu'à un retour explicite à l'automatique
// (cf. routes/zones.js POST /:id/seuil/auto).
// ─────────────────────────────────────────────
async function recomputeZoneSeuil(zoneMapId) {
  const [[zoneRow]] = await db.query("SELECT id, seuil_manual FROM zones WHERE map_id = ?", [zoneMapId]);
  if (!zoneRow || zoneRow.seuil_manual) return;

  const [[{ minSeuil }]] = await db.query(
    "SELECT MIN(seuil) AS minSeuil FROM sampling_points WHERE zone_map_id = ? AND seuil IS NOT NULL",
    [zoneMapId]
  );
  if (minSeuil !== null) {
    await db.query("UPDATE zones SET seuil = ? WHERE id = ?", [minSeuil, zoneRow.id]);
  }
}

module.exports = { recomputeZone, recomputeZoneSeuil, computeStatus, ALERT_MAP };
