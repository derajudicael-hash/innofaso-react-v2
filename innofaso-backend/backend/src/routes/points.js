const express = require("express");
const db      = require("../db");
const auth             = require("../middleware/auth");
const { computeNewPointPosition, resolvePointZone, inferPointType, queuePending } = require("../lib/pointResolution");
const { recomputeZone, recomputeZoneSeuil } = require("../lib/recomputeZone");

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
//
// x/y sont désormais optionnels : la position sur la carte n'a jamais été
// une donnée réelle (juste un repère visuel pour ne pas superposer les
// points), donc si le client ne les fournit pas, le serveur les calcule
// lui-même (même éventail que pour les points créés par import de bulletin).
router.post("/", auth, async (req, res) => {
  const { id, zone_map_id, label, x, y, point_type, description, ufc, seuil } = req.body;
  if (!id || !zone_map_id || !label) {
    return res.status(400).json({ error: "id, zone_map_id et label sont requis." });
  }
  const ufcVal   = (ufc   !== undefined && ufc   !== null && ufc   !== "") ? Number(ufc)   : null;
  const seuilVal = (seuil !== undefined && seuil !== null && seuil !== "") ? Number(seuil) : null;
  try {
    const pos = (x !== undefined && y !== undefined) ? { x: Number(x), y: Number(y) } : await computeNewPointPosition(zone_map_id);
    await db.query(
      "INSERT INTO sampling_points (id, zone_map_id, label, x, y, point_type, description, ufc, seuil) VALUES (?,?,?,?,?,?,?,?,?)",
      [id.trim(), zone_map_id, label.trim(), pos.x, pos.y, point_type || "1", description || "", ufcVal, seuilVal]
    );
    if (seuilVal !== null) await recomputeZoneSeuil(zone_map_id);
    if (ufcVal !== null) await recomputeZone(zone_map_id);
    res.status(201).json({ id: id.trim(), zone_map_id, label: label.trim(), x: pos.x, y: pos.y, point_type: point_type || "1", description: description || "", ufc: ufcVal, seuil: seuilVal });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: `L'identifiant "${id}" existe déjà.` });
    }
    console.error("POST /points error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// POST /api/points/register — enregistre manuellement un point officiel
// (ID réel E.S.N + description + résultat UFC, comme une ligne de bulletin)
// avant même qu'un bulletin ne le rapporte. La zone est déterminée
// automatiquement (salle puis mots-clés, cf. resolvePointZone) — si le
// système n'y arrive pas, le point part dans "Points à placer" comme à
// l'import, et l'admin en est informé pour pouvoir le placer lui-même.
// ─────────────────────────────────────────────
router.post("/register", auth, async (req, res) => {
  const { pointId, description, ufc, seuil } = req.body;
  if (!pointId?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "Identifiant et description sont requis." });
  }
  const id = pointId.trim();
  const ufcVal   = (ufc   !== undefined && ufc   !== null && ufc   !== "") ? Number(ufc)   : null;
  const seuilVal = (seuil !== undefined && seuil !== null && seuil !== "") ? Number(seuil) : null;

  try {
    const [[existingPoint]] = await db.query("SELECT id FROM sampling_points WHERE id = ?", [id]);
    if (existingPoint) {
      return res.status(409).json({ error: `Le point "${id}" existe déjà.` });
    }

    const { parsed, zoneMapId } = await resolvePointZone(id, description.trim());

    if (zoneMapId) {
      const pointType = inferPointType(parsed, id);
      const pos = await computeNewPointPosition(zoneMapId);
      await db.query(
        "INSERT INTO sampling_points (id, zone_map_id, label, x, y, point_type, description, ufc, seuil) VALUES (?,?,?,?,?,?,?,?,?)",
        [id, zoneMapId, id, pos.x, pos.y, pointType, description.trim(), ufcVal, seuilVal]
      );
      if (parsed?.room != null) {
        await db.query(
          "INSERT INTO room_zone_map (room, zone_map_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE zone_map_id = VALUES(zone_map_id)",
          [parsed.room, zoneMapId]
        );
      }
      if (seuilVal !== null) await recomputeZoneSeuil(zoneMapId);
      if (ufcVal !== null) await recomputeZone(zoneMapId);
      return res.status(201).json({
        created: true, pending: false, zoneMapId,
        point: { id, zone_map_id: zoneMapId, label: id, x: pos.x, y: pos.y, point_type: pointType, description: description.trim(), ufc: ufcVal, seuil: seuilVal },
      });
    }

    await queuePending({
      pointId: id,
      room: parsed?.room ?? null,
      pointType: parsed?.env ?? null,
      description: description.trim(),
      ufc: ufcVal,
      seuil: seuilVal,
      salmonella: null,
      cronobacter: null,
      importId: null,
      recordedAt: null,
    });
    res.status(202).json({ created: false, pending: true });
  } catch (err) {
    console.error("POST /points/register error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// PUT /api/points/:id — modifier un point (tout compte connecté : superadmin ou éditeur)
//
// Mise à jour partielle : seuls les champs effectivement fournis dans le
// corps de la requête sont modifiés, les autres gardent leur valeur actuelle
// (ex. l'admin ne corrige que l'UFC sans devoir renvoyer position/zone/libellé).
router.put("/:id", auth, async (req, res) => {
  try {
    const [[existing]] = await db.query("SELECT * FROM sampling_points WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Point introuvable." });

    const body = req.body || {};
    const zone_map_id  = "zone_map_id"  in body ? body.zone_map_id  : existing.zone_map_id;
    const label         = "label"        in body ? body.label        : existing.label;
    const x             = "x"            in body ? Number(body.x)    : Number(existing.x);
    const y             = "y"            in body ? Number(body.y)    : Number(existing.y);
    const point_type    = "point_type"   in body ? (body.point_type || "1") : existing.point_type;
    const description   = "description"  in body ? (body.description || "") : existing.description;
    const ufcVal = "ufc" in body
      ? ((body.ufc !== null && body.ufc !== "") ? Number(body.ufc) : null)
      : (existing.ufc !== null ? Number(existing.ufc) : null);
    const seuilVal = "seuil" in body
      ? ((body.seuil !== null && body.seuil !== "") ? Number(body.seuil) : null)
      : (existing.seuil !== null ? Number(existing.seuil) : null);

    const [result] = await db.query(
      "UPDATE sampling_points SET zone_map_id=?, label=?, x=?, y=?, point_type=?, description=?, ufc=?, seuil=? WHERE id=?",
      [zone_map_id, label, x, y, point_type, description, ufcVal, seuilVal, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Point introuvable." });

    // Si le point change de zone, l'ANCIENNE zone doit aussi être recalculée
    // (sinon elle reste figée sur un UFC/seuil qui incluait encore ce point) —
    // mais on ne touche pas zone_history sur une simple modif de libellé/
    // description qui ne change ni l'UFC, ni le seuil, ni la zone.
    // recomputeZoneSeuil() avant recomputeZone() : ce dernier recalcule aussi
    // le statut (ufc vs seuil) de la zone — il doit donc lire le seuil déjà à
    // jour, pas l'ancien.
    const zoneChanged = existing.zone_map_id !== zone_map_id;
    if ("seuil" in body || zoneChanged) {
      await recomputeZoneSeuil(zone_map_id);
      if (zoneChanged) await recomputeZoneSeuil(existing.zone_map_id);
    }
    if ("ufc" in body || zoneChanged) {
      await recomputeZone(zone_map_id);
      if (zoneChanged) await recomputeZone(existing.zone_map_id);
    }

    res.json({ id: req.params.id, zone_map_id, label, x, y, point_type, description, ufc: ufcVal, seuil: seuilVal });
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
    const [[existing]] = await db.query("SELECT zone_map_id FROM sampling_points WHERE id=?", [req.params.id]);
    const [result] = await db.query("DELETE FROM sampling_points WHERE id=?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Point introuvable." });
    // Le point supprimé pouvait porter l'UFC max ou le seuil le plus strict
    // de sa zone — sinon celle-ci reste figée sur ces valeurs jusqu'au
    // prochain import.
    if (existing?.zone_map_id) {
      await recomputeZoneSeuil(existing.zone_map_id);
      await recomputeZone(existing.zone_map_id);
    }
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
