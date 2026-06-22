const express = require("express");
const db      = require("../db");
const auth    = require("../middleware/auth");
const { placePendingPoint } = require("../lib/pointResolution");

const router = express.Router();

// GET /api/pending-points — points de bulletin non rattachés automatiquement
// à une zone (public, comme /api/points et /api/zones)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM pending_points ORDER BY created_at ASC");
    res.json(rows);
  } catch (err) {
    console.error("GET /pending-points error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// POST /api/pending-points/:id/resolve — place un point en attente dans la
// zone choisie : crée le point, enrichit room_zone_map pour les imports
// suivants (si la salle était connue), journalise l'historique, recalcule la
// zone, puis retire l'entrée en attente.
// ─────────────────────────────────────────────
router.post("/:id/resolve", auth, async (req, res) => {
  const { zoneMapId } = req.body;
  if (!zoneMapId) return res.status(400).json({ error: "zoneMapId requis." });

  try {
    const [[row]] = await db.query("SELECT * FROM pending_points WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Entrée en attente introuvable." });

    await placePendingPoint(row, zoneMapId);
    await db.query("DELETE FROM pending_points WHERE id = ?", [req.params.id]);

    res.json({ message: "Point placé avec succès.", pointId: row.point_id, zoneMapId });
  } catch (err) {
    console.error("POST /pending-points/:id/resolve error:", err);
    res.status(500).json({ error: "Erreur lors du placement du point." });
  }
});

// DELETE /api/pending-points/:id — ignore une entrée en attente (donnée
// jugée non pertinente, ex. erreur d'OCR du bulletin) sans créer de point.
router.delete("/:id", auth, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM pending_points WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Entrée en attente introuvable." });
    res.json({ message: "Entrée ignorée." });
  } catch (err) {
    console.error("DELETE /pending-points/:id error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
