const express = require("express");
const db      = require("../db");
const auth    = require("../middleware/auth");

const router = express.Router();

// Helper — compute status from ufc vs thresholds
async function computeStatus(ufc) {
  const [rows] = await db.query("SELECT name, value FROM thresholds");
  const t = {};
  rows.forEach((r) => { t[r.name] = Number(r.value); });
  if (ufc >= (t.critical ?? 50)) return "critical";
  if (ufc >= (t.warning  ?? 40)) return "warning";
  return "ok";
}

const ALERT_MAP = {
  critical: { alert_cls: "crit", alert_title: "Action requise",      alert_desc: "Niveau de contamination critique – Action immédiate requise" },
  warning:  { alert_cls: "warn", alert_title: "Surveillance requise", alert_desc: "Niveau proche du seuil – Surveiller l'évolution de près" },
  ok:       { alert_cls: "good", alert_title: "Zone conforme",        alert_desc: "Niveaux de contamination dans les limites acceptables" },
};

// ─────────────────────────────────────────────
// HELPER — get last 7 history points for one zone
// ─────────────────────────────────────────────
async function getHistory(zoneId) {
  const [rows] = await db.query(
    "SELECT ufc FROM zone_history WHERE zone_id = ? ORDER BY id DESC LIMIT 7",
    [zoneId]
  );
  return rows.map((r) => Number(r.ufc)).reverse();
}

// ─────────────────────────────────────────────
// HELPER — format a DB row to frontend shape
// ─────────────────────────────────────────────
async function formatZone(z) {
  const history = await getHistory(z.id);
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
    history:     history.length > 0 ? history : [Number(z.ufc)],
  };
}

// ─────────────────────────────────────────────
// GET /api/zones
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const [zones] = await db.query("SELECT * FROM zones ORDER BY id ASC");
    const result = [];
    for (const z of zones) {
      result.push(await formatZone(z));
    }
    res.json(result);
  } catch (err) {
    console.error("GET /zones error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// POST /api/zones  — créer une zone (admin)
// ─────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { label, ufc, seuil, responsible, lastCheck, nextCheck, mapId } = req.body;
  if (!label || ufc === undefined) {
    return res.status(400).json({ error: "label et ufc sont requis." });
  }

  try {
    const numUfc   = Number(ufc);
    const status   = await computeStatus(numUfc);
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
router.put("/:id", auth, async (req, res) => {
  const { id } = req.params;
  const { label, ufc, seuil, responsible, lastCheck, nextCheck } = req.body;

  try {
    const numUfc    = Number(ufc);
    const status    = await computeStatus(numUfc);
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
