const express = require("express");
const db      = require("../db");
const auth             = require("../middleware/auth");

const router = express.Router();

// GET /api/points — tous les points (public)
//
// last_measured_at : date du dernier relevé réel (point_history, en excluant
// les imports annulés) — permet de signaler un point non recontrôlé depuis
// longtemps, qui sinon reste affiché "conforme" indéfiniment sur sa dernière
// valeur connue sans que personne ne soit jamais alerté de son ancienneté.
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sp.*,
        (SELECT MAX(ph.recorded_at) FROM point_history ph
         JOIN import_batches ib ON ib.id = ph.import_id
         WHERE ph.point_id = sp.id AND ib.status != 'annule') AS last_measured_at
      FROM sampling_points sp
      ORDER BY sp.zone_map_id, sp.id
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /points error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// POST /api/points — créer un point (tout compte connecté : superadmin ou éditeur)
router.post("/", auth, async (req, res) => {
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

// PUT /api/points/:id — modifier un point (tout compte connecté : superadmin ou éditeur)
router.put("/:id", auth, async (req, res) => {
  const { zone_map_id, label, x, y, point_type, description, ufc } = req.body;
  const ufcVal = (ufc !== undefined && ufc !== null && ufc !== "") ? Number(ufc) : null;
  try {
    const [result] = await db.query(
      "UPDATE sampling_points SET zone_map_id=?, label=?, x=?, y=?, point_type=?, description=?, ufc=? WHERE id=?",
      [zone_map_id, label, Number(x), Number(y), point_type || "1", description || "", ufcVal, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Point introuvable." });

    // Enregistrement automatique de l'historique quand UFC est fourni
    if (ufcVal !== null) {
      const [[zoneRow]] = await db.query("SELECT id FROM zones WHERE map_id = ?", [zone_map_id]);
      if (zoneRow) {
        const [pts] = await db.query(
          "SELECT ufc FROM sampling_points WHERE zone_map_id = ? AND ufc IS NOT NULL",
          [zone_map_id]
        );
        if (pts.length > 0) {
          const maxUfc = Math.max(...pts.map(p => Number(p.ufc)));
          await db.query("INSERT INTO zone_history (zone_id, ufc) VALUES (?, ?)", [zoneRow.id, maxUfc]);
          await db.query(
            "DELETE FROM zone_history WHERE zone_id = ? AND recorded_at < DATE_SUB(NOW(), INTERVAL 90 DAY)",
            [zoneRow.id]
          );
          await db.query("UPDATE zones SET ufc = ? WHERE id = ?", [maxUfc, zoneRow.id]);
        }
      }
    }

    res.json({ id: req.params.id, zone_map_id, label, x: Number(x), y: Number(y), point_type: point_type || "1", description: description || "", ufc: ufcVal });
  } catch (err) {
    console.error("PUT /points/:id error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// DELETE /api/points/:id — supprimer un point (tout compte connecté : superadmin ou éditeur)
//
// Un point ayant déjà des mesures réelles (point_history) ne peut pas être
// supprimé : la contrainte FK (RESTRICT, cf. database.sql) bloque la requête
// plutôt que d'effacer silencieusement l'historique de mesures labo.
router.delete("/:id", auth, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM sampling_points WHERE id=?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Point introuvable." });
    res.json({ message: "Point supprimé." });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        error: "Ce point a déjà des mesures labo enregistrées dans son historique — il ne peut pas être supprimé sans perdre ces données.",
      });
    }
    console.error("DELETE /points/:id error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
