const express = require("express");
const db      = require("../db");
const auth    = require("../middleware/auth");

const router = express.Router();

// GET /api/production-batches — tous les lots (public, comme /api/points)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM production_batches ORDER BY date_start DESC");
    res.json(rows);
  } catch (err) {
    console.error("GET /production-batches error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// GET /api/production-batches/active-on?date=AAAA-MM-JJ — lots en cours à cette date
// (utilisé pour relier une non-conformité aux lots potentiellement concernés)
router.get("/active-on", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date requise." });
  try {
    const [rows] = await db.query(
      "SELECT * FROM production_batches WHERE date_start <= ? AND (date_end IS NULL OR date_end >= ?) ORDER BY date_start DESC",
      [date, date]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /production-batches/active-on error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// POST /api/production-batches — ouvrir un lot
router.post("/", auth, async (req, res) => {
  const { reference, dateStart } = req.body;
  if (!reference?.trim() || !dateStart) {
    return res.status(400).json({ error: "reference et dateStart sont requis." });
  }
  try {
    const [result] = await db.query(
      "INSERT INTO production_batches (reference, date_start, created_by) VALUES (?,?,?)",
      [reference.trim(), dateStart, req.user?.name || req.user?.username || "admin"]
    );
    const [[created]] = await db.query("SELECT * FROM production_batches WHERE id = ?", [result.insertId]);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Cette référence de lot existe déjà." });
    }
    console.error("POST /production-batches error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// POST /api/production-batches/:id/close — clore un lot (date de fin = aujourd'hui)
router.post("/:id/close", auth, async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE production_batches SET date_end = CURDATE() WHERE id = ? AND date_end IS NULL",
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Lot introuvable ou déjà clôturé." });
    res.json({ message: "Lot clôturé." });
  } catch (err) {
    console.error("POST /production-batches/:id/close error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
