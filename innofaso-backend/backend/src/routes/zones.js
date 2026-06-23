const express = require("express");
const db      = require("../db");
const auth    = require("../middleware/auth");
const { recomputeZoneSeuil, computeStatus, ALERT_MAP } = require("../lib/recomputeZone");

const router = express.Router();

// ─────────────────────────────────────────────
// HELPER — format a DB row to frontend shape
// ─────────────────────────────────────────────
function formatZone(z, historyByZone) {
  const history = historyByZone[z.id] || [Number(z.ufc)];
  return {
    id:          String(z.id),
    mapId:       z.map_id || null,
    label:       z.label,
    status:      z.status,
    ufc:         Number(z.ufc),
    seuil:       Number(z.seuil),
    seuilManual: !!z.seuil_manual,
    responsible: z.responsible,
    alertCls:    z.alert_cls,
    alertTitle:  z.alert_title,
    alertDesc:   z.alert_desc,
    history,
  };
}

// ─────────────────────────────────────────────
// GET /api/zones — 2 requêtes au lieu de N+1
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const [zones] = await db.query("SELECT * FROM zones ORDER BY id ASC");
    if (zones.length === 0) return res.json([]);

    // Une seule requête pour tout l'historique
    const ids = zones.map(z => z.id);
    const placeholders = ids.map(() => "?").join(",");
    const [allHistory] = await db.query(
      `SELECT zone_id, ufc FROM zone_history
       WHERE zone_id IN (${placeholders})
       ORDER BY zone_id ASC, id DESC`,
      ids
    );

    // Grouper les 7 derniers points par zone (ordre chronologique)
    const historyByZone = {};
    allHistory.forEach(h => {
      if (!historyByZone[h.zone_id]) historyByZone[h.zone_id] = [];
      if (historyByZone[h.zone_id].length < 7) {
        historyByZone[h.zone_id].push(Number(h.ufc));
      }
    });
    Object.keys(historyByZone).forEach(id => historyByZone[id].reverse());

    res.json(zones.map(z => formatZone(z, historyByZone)));
  } catch (err) {
    console.error("GET /zones error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// POST /api/zones  — créer une zone (tout compte connecté : superadmin ou éditeur)
// ─────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { label, ufc, seuil, responsible, mapId } = req.body;
  if (!label || ufc === undefined) {
    return res.status(400).json({ error: "label et ufc sont requis." });
  }

  try {
    const numUfc   = Number(ufc);
    const status   = computeStatus(numUfc, seuil ?? 50);
    const alertInfo = ALERT_MAP[status];

    const [result] = await db.query(
      `INSERT INTO zones (label, map_id, status, ufc, seuil, responsible, alert_cls, alert_title, alert_desc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        label, mapId ?? null, status, numUfc, seuil ?? 50,
        responsible ?? "Non assigné",
        alertInfo.alert_cls, alertInfo.alert_title, alertInfo.alert_desc,
      ]
    );

    const newId = result.insertId;

    // Add initial history point
    await db.query(
      "INSERT INTO zone_history (zone_id, ufc) VALUES (?, ?)",
      [newId, numUfc]
    );

    // Return the created zone
    const [rows] = await db.query("SELECT * FROM zones WHERE id = ?", [newId]);
    const z = rows[0];
    res.status(201).json({
      id: String(z.id), mapId: z.map_id || null, label: z.label, status: z.status,
      ufc: Number(z.ufc), seuil: Number(z.seuil), seuilManual: !!z.seuil_manual,
      responsible: z.responsible, alertCls: z.alert_cls,
      alertTitle: z.alert_title, alertDesc: z.alert_desc,
      history: [numUfc],
    });
  } catch (err) {
    console.error("POST /zones error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// PUT /api/zones/:id  — modifier une zone (tout compte connecté : superadmin ou éditeur)
// ─────────────────────────────────────────────
// seuilManual (booléen, optionnel) : envoyé uniquement quand l'admin vient
// de confirmer (ou d'annuler) un changement manuel de seuil — cf.
// ZonesTab. Absent lors d'une modification normale (responsable, libellé) :
// le statut seuil_manual de la zone n'est alors pas modifié.
router.put("/:id", auth, async (req, res) => {
  const { id } = req.params;
  const { label, ufc, seuil, responsible, seuilManual } = req.body;

  try {
    const numUfc    = Number(ufc);
    const status    = computeStatus(numUfc, seuil ?? 50);
    const alertInfo = ALERT_MAP[status];
    const setManual = typeof seuilManual === "boolean";

    const [updateResult] = await db.query(
      `UPDATE zones SET
        label = ?, status = ?, ufc = ?, seuil = ?,
        ${setManual ? "seuil_manual = ?," : ""}
        responsible = ?, alert_cls = ?, alert_title = ?, alert_desc = ?
       WHERE id = ?`,
      [
        label, status, numUfc, seuil ?? 50,
        ...(setManual ? [seuilManual ? 1 : 0] : []),
        responsible,
        alertInfo.alert_cls, alertInfo.alert_title, alertInfo.alert_desc,
        id,
      ]
    );
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: "Zone introuvable." });
    }

    // Record history point + purge > 90 jours
    await db.query("INSERT INTO zone_history (zone_id, ufc) VALUES (?, ?)", [id, numUfc]);
    await db.query(
      "DELETE FROM zone_history WHERE zone_id = ? AND recorded_at < DATE_SUB(NOW(), INTERVAL 90 DAY)",
      [id]
    );

    // Return updated zone with history
    const [rows] = await db.query("SELECT * FROM zones WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Zone introuvable." });

    const [h] = await db.query(
      "SELECT ufc FROM zone_history WHERE zone_id = ? ORDER BY id DESC LIMIT 7",
      [id]
    );
    const z = rows[0];
    res.json({
      id: String(z.id), mapId: z.map_id || null, label: z.label, status: z.status,
      ufc: Number(z.ufc), seuil: Number(z.seuil), seuilManual: !!z.seuil_manual,
      responsible: z.responsible, alertCls: z.alert_cls,
      alertTitle: z.alert_title, alertDesc: z.alert_desc,
      history: h.map((r) => Number(r.ufc)).reverse(),
    });
  } catch (err) {
    console.error("PUT /zones/:id error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// POST /api/zones/:id/seuil/auto — repasse le seuil de la zone en mode
// automatique (le bulletin redevient maître) et le recalcule immédiatement
// à partir du seuil le plus strict parmi ses points.
// ─────────────────────────────────────────────
router.post("/:id/seuil/auto", auth, async (req, res) => {
  try {
    const [[zone]] = await db.query("SELECT * FROM zones WHERE id = ?", [req.params.id]);
    if (!zone) return res.status(404).json({ error: "Zone introuvable." });

    await db.query("UPDATE zones SET seuil_manual = 0 WHERE id = ?", [zone.id]);
    if (zone.map_id) await recomputeZoneSeuil(zone.map_id);

    const [[updated]] = await db.query("SELECT * FROM zones WHERE id = ?", [zone.id]);
    res.json({
      id: String(updated.id), mapId: updated.map_id || null,
      seuil: Number(updated.seuil), seuilManual: !!updated.seuil_manual,
    });
  } catch (err) {
    console.error("POST /zones/:id/seuil/auto error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/zones/:id  — supprimer une zone (tout compte connecté : superadmin ou éditeur)
// ─────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query("DELETE FROM zones WHERE id = ?", [req.params.id]);
    res.json({ message: "Zone supprimée." });
  } catch (err) {
    console.error("DELETE /zones/:id error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
