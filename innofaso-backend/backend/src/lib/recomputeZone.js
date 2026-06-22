const db = require("../db");

// Recalcule l'UFC max d'une zone à partir de ses points mesurés, journalise
// zone_history (purge 90 jours) et met à jour zones.ufc — utilisé après tout
// import, toute annulation d'import, ou tout placement d'un point en attente
// qui touche les points de cette zone.
async function recomputeZone(zoneMapId) {
  const [[zoneRow]] = await db.query("SELECT id FROM zones WHERE map_id = ?", [zoneMapId]);
  if (!zoneRow) return;

  const [pts] = await db.query(
    "SELECT ufc FROM sampling_points WHERE zone_map_id = ? AND ufc IS NOT NULL",
    [zoneMapId]
  );
  const maxUfc = pts.length > 0 ? Math.max(...pts.map(p => Number(p.ufc))) : 0;

  await db.query("INSERT INTO zone_history (zone_id, ufc) VALUES (?, ?)", [zoneRow.id, maxUfc]);
  await db.query(
    "DELETE FROM zone_history WHERE zone_id = ? AND recorded_at < DATE_SUB(NOW(), INTERVAL 90 DAY)",
    [zoneRow.id]
  );
  await db.query("UPDATE zones SET ufc = ? WHERE id = ?", [maxUfc, zoneRow.id]);
}

module.exports = { recomputeZone };
