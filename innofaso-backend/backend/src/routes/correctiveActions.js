const express = require("express");
const db      = require("../db");
const auth    = require("../middleware/auth");

const router = express.Router();

// GET /api/corrective-actions — toutes les actions (public, comme /api/points)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM corrective_actions ORDER BY status ASC, due_date IS NULL, due_date ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /corrective-actions error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// POST /api/corrective-actions — ouvrir une action corrective sur un point
router.post("/", auth, async (req, res) => {
  const { pointId, description, responsible, dueDate } = req.body;
  if (!pointId || !description?.trim() || !responsible?.trim()) {
    return res.status(400).json({ error: "pointId, description et responsable sont requis." });
  }
  try {
    const [[point]] = await db.query("SELECT id FROM sampling_points WHERE id = ?", [pointId]);
    if (!point) return res.status(404).json({ error: "Point introuvable." });

    const [result] = await db.query(
      "INSERT INTO corrective_actions (point_id, description, responsible, due_date, opened_by) VALUES (?,?,?,?,?)",
      [pointId, description.trim(), responsible.trim(), dueDate || null, req.user?.name || req.user?.username || "admin"]
    );
    const [[created]] = await db.query("SELECT * FROM corrective_actions WHERE id = ?", [result.insertId]);
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /corrective-actions error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// POST /api/corrective-actions/:id/close — clore une action corrective
router.post("/:id/close", auth, async (req, res) => {
  try {
    const [[action]] = await db.query("SELECT * FROM corrective_actions WHERE id = ?", [req.params.id]);
    if (!action) return res.status(404).json({ error: "Action introuvable." });
    if (action.status === "fermee") return res.status(400).json({ error: "Cette action est déjà fermée." });

    await db.query(
      "UPDATE corrective_actions SET status = 'fermee', closed_by = ?, closed_at = NOW() WHERE id = ?",
      [req.user?.name || req.user?.username || "admin", req.params.id]
    );
    res.json({ message: "Action corrective clôturée." });
  } catch (err) {
    console.error("POST /corrective-actions/:id/close error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
