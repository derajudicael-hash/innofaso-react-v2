const express = require("express");
const db      = require("../db");
const auth    = require("../middleware/auth");

const router = express.Router();

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
// PUT /api/settings/site  (tout compte connecté : superadmin ou éditeur)
// ─────────────────────────────────────────────
router.put("/site", auth, async (req, res) => {
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
