const express = require("express");
const db      = require("../db");
const auth             = require("../middleware/auth");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/points — tous les points (public)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM sampling_points ORDER BY zone_map_id, id"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /points error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// POST /api/points — créer un point (admin)
router.post("/", auth, requireAdmin, async (req, res) => {
  const { id, zone_map_id, label, x, y, point_type, description, ufc } = req.body;
  if (!id || !zone_map_id || !label || x === undefined || y === undefined) {
    return res.status(400).json({ error: "id, zone_map_id, label, x, y sont requis." });
  }
  const ufcVal = (ufc !== undefined && ufc !== null && ufc !== "") ? Number(ufc) : null;
  try {
    await db.query(
      "INSERT INTO sampling_points (id, zone_map_id, label, x, y, point_type, description, ufc) VALUES (?,?,?,?,?,?,?,?)",
      [id.trim(), zone_map_id, label.trim(), Number(x), Number(y), point_type || "1", description || "", ufcVal]
    );
    res.status(201).json({ id: id.trim(), zone_map_id, label: label.trim(), x: Number(x), y: Number(y), point_type: point_type || "1", description: description || "", ufc: ufcVal });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: `L'identifiant "${id}" existe déjà.` });
    }
    console.error("POST /points error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// PUT /api/points/:id — modifier un point (admin)
router.put("/:id", auth, requireAdmin, async (req, res) => {
  const { zone_map_id, label, x, y, point_type, description, ufc } = req.body;
  const ufcVal = (ufc !== undefined && ufc !== null && ufc !== "") ? Number(ufc) : null;
  try {
    const [result] = await db.query(
      "UPDATE sampling_points SET zone_map_id=?, label=?, x=?, y=?, point_type=?, description=?, ufc=? WHERE id=?",
      [zone_map_id, label, Number(x), Number(y), point_type || "1", description || "", ufcVal, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Point introuvable." });
    res.json({ id: req.params.id, zone_map_id, label, x: Number(x), y: Number(y), point_type: point_type || "1", description: description || "", ufc: ufcVal });
  } catch (err) {
    console.error("PUT /points/:id error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// DELETE /api/points/:id — supprimer un point (admin)
router.delete("/:id", auth, requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM sampling_points WHERE id=?", [req.params.id]);
    res.json({ message: "Point supprimé." });
  } catch (err) {
    console.error("DELETE /points/:id error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
