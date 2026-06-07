const express = require("express");
const db      = require("../db");
const auth            = require("../middleware/auth");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Compute status from ufc vs zone's own seuil
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
    responsible: z.responsible,
    lastCheck:   z.last_check,
    nextCheck:   z.next_check,
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
// POST /api/zones  — créer une zone (admin)
// ─────────────────────────────────────────────
router.post("/", auth, requireAdmin, async (req, res) => {
  const { label, ufc, seuil, responsible, lastCheck, nextCheck, mapId } = req.body;
  if (!label || ufc === undefined) {
    return res.status(400).json({ error: "label et ufc sont requis." });
  }

  try {
    const numUfc   = Number(ufc);
    const status   = computeStatus(numUfc, seuil ?? 50);
    const alertInfo = ALERT_MAP[status];

    const [result] = await db.query(
      `INSERT INTO zones (label, map_id, status, ufc, seuil, responsible, last_check, next_check, alert_cls, alert_title, alert_desc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        label, mapId ?? null, status, numUfc, seuil ?? 50,
        responsible ?? "Non assigné",
        lastCheck   ?? new Date().toLocaleDateString("fr-FR"),
        nextCheck   ?? "—",
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
      ufc: Number(z.ufc), seuil: Number(z.seuil),
      responsible: z.responsible, lastCheck: z.last_check,
      nextCheck: z.next_check, alertCls: z.alert_cls,
      alertTitle: z.alert_title, alertDesc: z.alert_desc,
      history: [numUfc],
    });
  } catch (err) {
    console.error("POST /zones error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// PUT /api/zones/:id  — modifier une zone (admin)
// ─────────────────────────────────────────────
router.put("/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { label, ufc, seuil, responsible, lastCheck, nextCheck } = req.body;

  try {
    const numUfc    = Number(ufc);
    const status    = computeStatus(numUfc, seuil ?? 50);
    const alertInfo = ALERT_MAP[status];

    await db.query(
      `UPDATE zones SET
        label = ?, status = ?, ufc = ?, seuil = ?,
        responsible = ?, last_check = ?, next_check = ?,
        alert_cls = ?, alert_title = ?, alert_desc = ?
       WHERE id = ?`,
      [
        label, status, numUfc, seuil ?? 50,
        responsible, lastCheck, nextCheck,
        alertInfo.alert_cls, alertInfo.alert_title, alertInfo.alert_desc,
        id,
      ]
    );

    // Record history point
    await db.query(
      "INSERT INTO zone_history (zone_id, ufc) VALUES (?, ?)",
      [id, numUfc]
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
      ufc: Number(z.ufc), seuil: Number(z.seuil),
      responsible: z.responsible, lastCheck: z.last_check,
      nextCheck: z.next_check, alertCls: z.alert_cls,
      alertTitle: z.alert_title, alertDesc: z.alert_desc,
      history: h.map((r) => Number(r.ufc)).reverse(),
    });
  } catch (err) {
    console.error("PUT /zones/:id error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/zones/:id  — supprimer une zone (admin)
// ─────────────────────────────────────────────
router.delete("/:id", auth, requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM zones WHERE id = ?", [req.params.id]);
    res.json({ message: "Zone supprimée." });
  } catch (err) {
    console.error("DELETE /zones/:id error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
