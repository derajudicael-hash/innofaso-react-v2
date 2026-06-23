const express = require("express");
const db      = require("../db");
const auth    = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/settings/site
// ─────────────────────────────────────────────
router.get("/site", async (req, res) => {
  try {
    // site_info héberge aussi d'autres réglages internes (ex. le bulletin
    // affiché sur la carte) — on ne renvoie ici que les clés d'identité du site.
    const [rows] = await db.query(
      "SELECT key_name, key_value FROM site_info WHERE key_name IN ('name','city','country','contact','phone')"
    );
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

// ─────────────────────────────────────────────
// Bulletin affiché sur la carte — par défaut (valeur vide), c'est le
// dernier bulletin importé qui détermine les points visibles. L'admin peut
// choisir de revoir un bulletin précédent (jusqu'à 30, cf. useMapDisplaySelection.js
// côté frontend) ; tout nouvel import reprend automatiquement la main
// (cf. routes/labResults.js). Stocké dans site_info pour ne pas créer une
// table à une seule ligne.
// ─────────────────────────────────────────────
router.get("/map-display", async (req, res) => {
  try {
    const [[row]] = await db.query("SELECT key_value FROM site_info WHERE key_name = 'map_display_import_id'");
    const raw = row?.key_value;
    res.json({ importId: raw ? Number(raw) : null });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.put("/map-display", auth, async (req, res) => {
  const { importId } = req.body;
  try {
    await db.query(
      "INSERT INTO site_info (key_name, key_value) VALUES ('map_display_import_id', ?) ON DUPLICATE KEY UPDATE key_value = VALUES(key_value)",
      [importId ? String(importId) : ""]
    );
    res.json({ importId: importId ?? null });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
