const express = require("express");
const db      = require("../db");
const auth             = require("../middleware/auth");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/settings/thresholds
// ─────────────────────────────────────────────
router.get("/thresholds", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT name, value FROM thresholds");
    const result = {};
    rows.forEach((r) => { result[r.name] = Number(r.value); });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// PUT /api/settings/thresholds  (admin)
// ─────────────────────────────────────────────
router.put("/thresholds", auth, requireAdmin, async (req, res) => {
  const { critical, warning } = req.body;
  if (Number(warning) >= Number(critical)) {
    return res.status(400).json({ error: "Le seuil warning doit être inférieur au seuil critique." });
  }
  try {
    await db.query(
      "INSERT INTO thresholds (name, value) VALUES ('critical',?),('warning',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",
      [critical, warning]
    );
    res.json({ critical: Number(critical), warning: Number(warning) });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// GET /api/settings/site
// ─────────────────────────────────────────────
router.get("/site", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT key_name, key_value FROM site_info");
    const result = {};
    rows.forEach((r) => { result[r.key_name] = r.key_value; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// PUT /api/settings/site  (admin)
// ─────────────────────────────────────────────
router.put("/site", auth, requireAdmin, async (req, res) => {
  const fields = ["name", "city", "country", "contact", "phone"];
  try {
    for (const key of fields) {
      if (req.body[key] !== undefined) {
        await db.query(
          "INSERT INTO site_info (key_name, key_value) VALUES (?,?) ON DUPLICATE KEY UPDATE key_value=VALUES(key_value)",
          [key, req.body[key]]
        );
      }
    }
    res.json({ message: "Informations mises à jour." });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
