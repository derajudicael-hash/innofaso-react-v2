const express = require("express");
const db      = require("../db");
const auth             = require("../middleware/auth");
const { requireAdmin } = require("../middleware/auth");
const { recomputeZone, recomputeZoneSeuil } = require("../lib/recomputeZone");
const { computeNewPointPosition, resolvePointZone, inferPointType, queuePending } = require("../lib/pointResolution");

const router = express.Router();

// Fenêtre glissante de l'historique par point (cf. refonte historique juin 2026).
// 365 jours plutôt que 30 : un référentiel qualité alimentaire impose en
// général une conservation des relevés de surveillance sur plusieurs mois à
// plusieurs années pour les audits — 30 jours était trop court pour un usage
// réel, même avec le rappel d'export en place.
const RETENTION_DAYS = 365;

// Purge les relevés plus anciens que la fenêtre de rétention — appelée après
// chaque import plutôt qu'au moment d'une lecture (GET /history) : une
// requête de lecture ne doit jamais avoir d'effet de bord sur les données.
async function purgeOldHistory() {
  await db.query(
    `DELETE ph FROM point_history ph
     JOIN import_batches ib ON ib.id = ph.import_id
     WHERE ib.imported_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [RETENTION_DAYS]
  );
}

// Convertit une date "JJ/MM/AAAA" (extraite du bulletin par le frontend,
// cf. labParser.js) en objet Date — utilisé comme date de relevé dans
// point_history à la place de la date d'import, pour que l'historique et les
// courbes reflètent la date du prélèvement et non le jour où l'admin a
// cliqué sur "importer". Une date invalide ou future (bulletin mal formé)
// retombe sur "maintenant".
function parseReportDate(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime()) || d.getTime() > Date.now()) return null;
  return d;
}

// Un bulletin peut afficher plusieurs dates pour un même libellé (ex: "Date
// de réception : 15/12/2026 et 16/12/2025" — coquille d'année sur l'une des
// deux). Le frontend (labParser.js) envoie toutes les dates candidates dans
// l'ordre de priorité ; on essaie chacune jusqu'à en trouver une valide
// (passé, format correct) au lieu d'abandonner sur la première invalide.
function pickReportDate(results) {
  const withDates = results.find(
    r => (Array.isArray(r?.dateCandidates) && r.dateCandidates.length) || r?.date
  );
  if (!withDates) return new Date();

  const candidates =
    Array.isArray(withDates.dateCandidates) && withDates.dateCandidates.length
      ? withDates.dateCandidates
      : [withDates.date];

  for (const c of candidates) {
    const d = parseReportDate(c);
    if (d) return d;
  }
  return new Date();
}

// ─────────────────────────────────────────────
// POST /api/lab-results/import — importe les résultats d'un bulletin
// (tout compte connecté : superadmin ou éditeur — seule l'annulation
// d'import ci-dessous reste réservée au super administrateur)
//
// Met à jour l'UFC de chaque point connu, recalcule l'UFC max des zones
// touchées (zone_history, comme avant) ET journalise désormais chaque point
// touché dans point_history, rattaché à un import_batches — fondation à la
// fois des courbes par point (Historique) et de l'annulation d'import.
// ─────────────────────────────────────────────
router.post("/import", auth, async (req, res) => {
  const { results, filename } = req.body;

  if (!Array.isArray(results)) {
    return res.status(400).json({ error: "Résultats invalides" });
  }

  try {
    // Date du relevé = date de réception extraite du bulletin (un seul
    // bulletin = une seule date de réception pour tous ses points), avec
    // essai de toutes les dates candidates avant de retomber sur "maintenant"
    // (cf. pickReportDate ci-dessus).
    const reportDate = pickReportDate(results);

    // Regroupe les résultats par point : un bulletin peut rapporter une ligne
    // entérobactéries (numericValue) et/ou une ligne salmonelles (detected)
    // pour le même point.
    const byPoint = new Map();
    for (const r of results) {
      const pointId = r?.pointId;
      if (!pointId) continue;
      if (!byPoint.has(pointId)) byPoint.set(pointId, {});
      const entry = byPoint.get(pointId);
      if (r.parameter === "salmonelles") {
        entry.salmonella = r.detected ?? null;
      } else if (r.parameter === "cronobacter") {
        entry.cronobacter = r.detected ?? null;
      } else if (r.numericValue !== undefined && r.numericValue !== null) {
        entry.ufc = r.numericValue;
      }
      if (r.description) entry.description = r.description;
      // Colonne "Spécifications" du bulletin (ex. "<10") — alimente le seuil
      // du point puis, tant que la zone n'est pas en seuil manuel, le seuil
      // de la zone elle-même (cf. recomputeZoneSeuil).
      if (r.spec !== undefined && r.spec !== null) entry.seuil = r.spec;
    }

    // Journal de l'import créé en premier : sert à la fois aux points déjà
    // connus (touches), aux points nouvellement créés, et aux points mis en
    // attente (pending_points.import_id) — traçabilité complète, même si le
    // bulletin ne contient que des identifiants inconnus.
    const [batch] = await db.query(
      "INSERT INTO import_batches (filename, imported_by, result_count) VALUES (?, ?, ?)",
      [filename || "bulletin", req.user?.name || req.user?.username || "admin", results.length]
    );
    const importId = batch.insertId;

    const createdIds  = [];
    const pendingIds  = [];
    const touchedZones = new Set();
    const touches = []; // { pointId, ufcBefore, ufcAfter, salmonella }
    let updatedCount = 0;

    for (const [pointId, entry] of byPoint) {
      const [[row]] = await db.query(
        "SELECT zone_map_id, ufc, label FROM sampling_points WHERE id = ?",
        [pointId]
      );

      if (!row) {
        // Point inconnu : résolution automatique par ordre de fiabilité —
        // 1) salle déjà cartographiée, 2) mots-clés de sa description — et
        // seulement si les deux échouent, mise en attente pour l'admin.
        const { parsed, zoneMapId, viaGuess } = await resolvePointZone(pointId, entry.description);

        if (zoneMapId) {
          const pointType = inferPointType(parsed, pointId);
          const pos = await computeNewPointPosition(zoneMapId);
          await db.query(
            "INSERT INTO sampling_points (id, zone_map_id, label, x, y, point_type, description, ufc, seuil) VALUES (?,?,?,?,?,?,?,?,?)",
            [pointId, zoneMapId, pointId, pos.x, pos.y, pointType, entry.description || "", entry.ufc ?? null, entry.seuil ?? null]
          );
          createdIds.push(pointId);
          touchedZones.add(zoneMapId);
          touches.push({ pointId, ufcBefore: null, ufcAfter: entry.ufc ?? null, salmonella: entry.salmonella ?? null, cronobacter: entry.cronobacter ?? null });

          // Une entrée en attente pour ce même ID a pu être créée par un
          // bulletin précédent dont la description ne permettait pas encore
          // de résoudre la zone — maintenant qu'il existe réellement, elle
          // serait trompeuse (l'admin la verrait alors que le point est déjà
          // placé) : on la retire.
          await db.query("DELETE FROM pending_points WHERE point_id = ?", [pointId]);

          // La salle vient d'être déduite par mots-clés : on l'enregistre
          // dans room_zone_map pour que les imports suivants la rattachent
          // directement (tier 1) sans repasser par la déduction par texte.
          if (viaGuess && parsed?.room != null) {
            await db.query(
              "INSERT INTO room_zone_map (room, zone_map_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE zone_map_id = VALUES(zone_map_id)",
              [parsed.room, zoneMapId]
            );
          }
        } else {
          await queuePending({
            pointId,
            room: parsed?.room ?? null,
            pointType: parsed?.env ?? null,
            description: entry.description || "",
            ufc: entry.ufc ?? null,
            seuil: entry.seuil ?? null,
            salmonella: entry.salmonella ?? null,
            cronobacter: entry.cronobacter ?? null,
            importId,
            recordedAt: reportDate,
          });
          pendingIds.push(pointId);
        }
        continue;
      }

      const ufcBefore = row.ufc !== null ? Number(row.ufc) : null;
      const hasUfc     = entry.ufc !== undefined && entry.ufc !== null;
      const ufcAfter   = hasUfc ? entry.ufc : ufcBefore;
      const hasSeuil   = entry.seuil !== undefined && entry.seuil !== null;

      if (hasUfc || hasSeuil) {
        if (hasUfc)   await db.query("UPDATE sampling_points SET ufc = ? WHERE id = ?", [ufcAfter, pointId]);
        if (hasSeuil) await db.query("UPDATE sampling_points SET seuil = ? WHERE id = ?", [entry.seuil, pointId]);
        if (hasUfc) updatedCount++;
      }

      touchedZones.add(row.zone_map_id);
      touches.push({ pointId, ufcBefore, ufcAfter, salmonella: entry.salmonella ?? null, cronobacter: entry.cronobacter ?? null });

      // Même nettoyage que ci-dessus : le point existe déjà, toute entrée en
      // attente résiduelle pour ce même ID n'a plus de raison d'être.
      await db.query("DELETE FROM pending_points WHERE point_id = ?", [pointId]);

      // Points dupliqués par label (ex. '2.3.1' / '2.3.1b' désignent 2 points
      // physiques distincts mais le bulletin ne rapporte jamais que l'ID nu) :
      // le résultat s'applique à tous les points partageant ce label, sinon
      // les variantes suffixées ne reçoivent jamais aucune mise à jour réelle.
      const [siblings] = await db.query(
        "SELECT id, zone_map_id, ufc FROM sampling_points WHERE label = ? AND id != ?",
        [row.label, pointId]
      );
      for (const sib of siblings) {
        if (byPoint.has(sib.id)) continue; // déjà géré par sa propre entrée du bulletin
        const sibUfcBefore = sib.ufc !== null ? Number(sib.ufc) : null;
        const sibUfcAfter  = hasUfc ? entry.ufc : sibUfcBefore;
        if (hasUfc) {
          await db.query("UPDATE sampling_points SET ufc = ? WHERE id = ?", [sibUfcAfter, sib.id]);
          updatedCount++;
        }
        if (hasSeuil) await db.query("UPDATE sampling_points SET seuil = ? WHERE id = ?", [entry.seuil, sib.id]);
        touchedZones.add(sib.zone_map_id);
        touches.push({ pointId: sib.id, ufcBefore: sibUfcBefore, ufcAfter: sibUfcAfter, salmonella: entry.salmonella ?? null, cronobacter: entry.cronobacter ?? null });
      }
    }

    for (const t of touches) {
      await db.query(
        "INSERT INTO point_history (point_id, import_id, ufc_before, ufc_after, salmonella_detected, cronobacter_detected, recorded_at) VALUES (?,?,?,?,?,?,?)",
        [t.pointId, importId, t.ufcBefore, t.ufcAfter, t.salmonella, t.cronobacter, reportDate]
      );
    }

    for (const zoneMapId of touchedZones) {
      // Seuil avant UFC : recomputeZone() recalcule aussi le statut de la
      // zone à partir de son seuil, qui doit donc déjà être à jour.
      await recomputeZoneSeuil(zoneMapId);
      await recomputeZone(zoneMapId);
    }

    await purgeOldHistory();

    // Un nouvel import reprend toujours la main sur l'affichage de la carte,
    // même si l'admin avait choisi de revoir un bulletin précédent (cf.
    // réglage "Bulletin affiché sur la carte", routes/settings.js).
    await db.query(
      "INSERT INTO site_info (key_name, key_value) VALUES ('map_display_import_id', '') ON DUPLICATE KEY UPDATE key_value = ''"
    );

    res.json({
      message: "Résultats importés avec succès",
      count: results.length,
      updated: updatedCount,
      created: createdIds,
      pending: pendingIds,
      importId,
    });
  } catch (err) {
    console.error("Lab results import error:", err);
    res.status(500).json({ error: "Erreur lors de l'import des résultats" });
  }
});

// ─────────────────────────────────────────────
// GET /api/lab-results/imports — journal des imports (lecture publique)
// ─────────────────────────────────────────────
router.get("/imports", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, filename, imported_by, imported_at, result_count, status, cancelled_at, cancelled_by
       FROM import_batches ORDER BY id DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /lab-results/imports error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// GET /api/lab-results/:importId/points — IDs des points rapportés par cet
// import précis (lecture publique) — sert à filtrer la carte sur "les points
// qui sont dans ce bulletin" (cf. réglage "Bulletin affiché sur la carte").
// ─────────────────────────────────────────────
router.get("/:importId/points", async (req, res) => {
  const importId = Number(req.params.importId);
  if (!Number.isInteger(importId)) {
    return res.status(400).json({ error: "Identifiant d'import invalide." });
  }
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT point_id FROM point_history WHERE import_id = ?",
      [importId]
    );
    res.json(rows.map(r => r.point_id));
  } catch (err) {
    console.error("GET /lab-results/:importId/points error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// POST /api/lab-results/:importId/undo — annule un import (superadmin)
//
// Règle de sécurité (décidée avec l'utilisateur) : restaure la valeur d'avant
// import pour chaque point touché, SAUF si un import plus récent (et non
// lui-même annulé) a déjà retouché ce même point — dans ce cas on retire
// seulement les points de courbe ajoutés par l'import annulé, sans écraser
// une donnée plus récente. Toujours disponible, quelle que soit l'ancienneté.
//
// Important (intégrité de l'audit) : on ne supprime JAMAIS physiquement une
// ligne de point_history, même annulée — un enregistrement de mesure labo
// réel ne doit jamais disparaître d'une base de données qualité, y compris
// par erreur. L'import annulé est simplement marqué status='annule' et les
// requêtes de lecture (GET /history, le check "later" ci-dessous) l'excluent
// explicitement des courbes actives.
// ─────────────────────────────────────────────
router.post("/:importId/undo", auth, requireAdmin, async (req, res) => {
  const importId = Number(req.params.importId);
  if (!Number.isInteger(importId)) {
    return res.status(400).json({ error: "Identifiant d'import invalide." });
  }

  try {
    const [[batch]] = await db.query("SELECT * FROM import_batches WHERE id = ?", [importId]);
    if (!batch) return res.status(404).json({ error: "Import introuvable." });
    if (batch.status === "annule") {
      return res.status(400).json({ error: "Cet import a déjà été annulé." });
    }

    const [rows] = await db.query(
      "SELECT * FROM point_history WHERE import_id = ? ORDER BY id ASC",
      [importId]
    );

    const restoredPoints = [];
    const keptPoints     = [];
    const touchedZones   = new Set();

    for (const row of rows) {
      const [[later]] = await db.query(
        `SELECT ph.id FROM point_history ph
         JOIN import_batches ib ON ib.id = ph.import_id
         WHERE ph.point_id = ? AND ph.id > ? AND ib.status != 'annule'
         LIMIT 1`,
        [row.point_id, row.id]
      );

      if (!later) {
        await db.query("UPDATE sampling_points SET ufc = ? WHERE id = ?", [row.ufc_before, row.point_id]);
        const [[ptRow]] = await db.query("SELECT zone_map_id FROM sampling_points WHERE id = ?", [row.point_id]);
        if (ptRow) touchedZones.add(ptRow.zone_map_id);
        restoredPoints.push(row.point_id);
      } else {
        keptPoints.push(row.point_id);
      }
    }

    for (const zoneMapId of touchedZones) {
      await recomputeZone(zoneMapId);
    }

    await db.query(
      "UPDATE import_batches SET status = 'annule', cancelled_at = NOW(), cancelled_by = ? WHERE id = ?",
      [req.user?.name || req.user?.username || "admin", importId]
    );

    res.json({
      message: "Import annulé avec succès.",
      restoredPoints,
      keptPoints,
    });
  } catch (err) {
    console.error("Undo import error:", err);
    res.status(500).json({ error: "Erreur lors de l'annulation de l'import." });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/lab-results/:importId — supprime définitivement un import déjà
// annulé (superadmin). Contrairement à l'annulation ci-dessus, qui ne touche
// jamais physiquement point_history (intégrité d'audit), cette suppression
// efface l'import et tout son historique réel — comme s'il n'avait jamais
// été importé. Réservée à un import déjà annulé : impossible de supprimer
// directement un import actif sans passer par l'annulation au préalable.
// Décision utilisateur (juin 2026) : aucun garde-fou ici (contrairement à
// l'annulation, qui protège les imports plus récents) — suppression brute.
// ─────────────────────────────────────────────
router.delete("/:importId", auth, requireAdmin, async (req, res) => {
  const importId = Number(req.params.importId);
  if (!Number.isInteger(importId)) {
    return res.status(400).json({ error: "Identifiant d'import invalide." });
  }

  try {
    const [[batch]] = await db.query("SELECT * FROM import_batches WHERE id = ?", [importId]);
    if (!batch) return res.status(404).json({ error: "Import introuvable." });
    if (batch.status !== "annule") {
      return res.status(400).json({ error: "Seul un import déjà annulé peut être supprimé complètement." });
    }

    // Tous les points touchés par CET import — avant de le supprimer, tant
    // que son historique existe encore pour pouvoir les identifier.
    const [touchedRows] = await db.query(
      "SELECT DISTINCT point_id FROM point_history WHERE import_id = ?",
      [importId]
    );

    // point_history.import_id est en ON DELETE CASCADE : la suppression de
    // l'import efface aussi tout son historique réel en une seule requête.
    await db.query("DELETE FROM import_batches WHERE id = ?", [importId]);

    // Pour chaque point touché, vérifie s'il lui reste un historique
    // RÉEL (peu importe quel import l'a créé à l'origine) — s'il n'en
    // reste plus du tout, c'est qu'aucun bulletin existant ne le justifie
    // plus : on le supprime aussi, sinon il reste un point "fantôme" sur la
    // carte. Décisif : se baser sur "plus aucun historique" plutôt que sur
    // "était-ce CET import qui l'avait créé" — sinon, supprimer les imports
    // un par un dans le mauvais ordre laisse des fantômes (la preuve de
    // création disparaît avant que le tout dernier import restant ne soit
    // lui-même supprimé). Un point créé à la main (jamais dans
    // point_history) n'apparaît jamais dans touchedRows : toujours protégé.
    const pointsToDelete = [];
    for (const { point_id } of touchedRows) {
      const [[{ remaining }]] = await db.query(
        "SELECT COUNT(*) AS remaining FROM point_history WHERE point_id = ?",
        [point_id]
      );
      if (remaining === 0) pointsToDelete.push(point_id);
    }

    if (pointsToDelete.length > 0) {
      const touchedZones = new Set();
      for (const pointId of pointsToDelete) {
        const [[pt]] = await db.query("SELECT zone_map_id FROM sampling_points WHERE id = ?", [pointId]);
        if (pt) touchedZones.add(pt.zone_map_id);
      }
      await db.query(
        `DELETE FROM sampling_points WHERE id IN (${pointsToDelete.map(() => "?").join(",")})`,
        pointsToDelete
      );
      for (const zoneMapId of touchedZones) {
        await recomputeZoneSeuil(zoneMapId);
        await recomputeZone(zoneMapId);
      }
    }

    res.json({ message: "Import supprimé définitivement.", deletedPoints: pointsToDelete });
  } catch (err) {
    console.error("Delete import error:", err);
    res.status(500).json({ error: "Erreur lors de la suppression de l'import." });
  }
});

// ─────────────────────────────────────────────
// GET /api/lab-results/history?zoneMapId=... — courbes par point d'une zone
// (lecture publique, comme GET /api/zones et GET /api/points)
//
// La purge de rétention (cf. purgeOldHistory ci-dessus) se fait désormais
// après chaque import, jamais ici : une lecture ne doit jamais avoir d'effet
// de bord sur les données (anti-pattern corrigé — auparavant un simple
// chargement de courbe déclenchait une suppression en base).
//
// La fenêtre de rétention est une politique de STOCKAGE (durée pendant
// laquelle le système garde l'historique avant de devoir l'exporter), pas
// une fenêtre sur la date réelle du bulletin — elle se compte donc depuis
// le moment où le bulletin a été importé (import_batches.imported_at), et
// non depuis la date de réception du bulletin (point_history.recorded_at).
// Sinon, importer un bulletin en retard (ex: un bulletin de janvier importé
// en juin) ferait disparaître ses données aussitôt après l'import.
// ─────────────────────────────────────────────
router.get("/history", async (req, res) => {
  const { zoneMapId } = req.query;
  if (!zoneMapId) return res.status(400).json({ error: "zoneMapId requis." });

  try {
    const [rows] = await db.query(
      `SELECT ph.point_id, ph.ufc_after, ph.salmonella_detected, ph.cronobacter_detected, ph.recorded_at,
              sp.label, sp.description, sp.point_type
       FROM point_history ph
       JOIN sampling_points sp ON sp.id = ph.point_id
       JOIN import_batches ib ON ib.id = ph.import_id
       WHERE sp.zone_map_id = ? AND ib.status != 'annule'
       ORDER BY ph.point_id ASC, ph.recorded_at ASC`,
      [zoneMapId]
    );

    const byPoint = {};
    for (const r of rows) {
      if (!byPoint[r.point_id]) {
        byPoint[r.point_id] = {
          pointId:     r.point_id,
          label:       r.label,
          description: r.description,
          pointType:   r.point_type,
          series:      [],
        };
      }
      byPoint[r.point_id].series.push({
        ufc:         r.ufc_after !== null ? Number(r.ufc_after) : null,
        salmonella:  r.salmonella_detected === null ? null : !!r.salmonella_detected,
        cronobacter: r.cronobacter_detected === null ? null : !!r.cronobacter_detected,
        date:        r.recorded_at,
      });
    }

    res.json(Object.values(byPoint));
  } catch (err) {
    console.error("GET /lab-results/history error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────
// GET /api/lab-results/retention-status — pour le bandeau de rappel d'export
// ─────────────────────────────────────────────
router.get("/retention-status", async (req, res) => {
  try {
    // Même logique que la purge ci-dessus : l'ancienneté se compte depuis
    // l'import (import_batches.imported_at), pas depuis la date du bulletin.
    const [[row]] = await db.query(
      `SELECT MIN(ib.imported_at) AS oldest
       FROM point_history ph
       JOIN import_batches ib ON ib.id = ph.import_id`
    );
    if (!row || !row.oldest) {
      return res.json({ oldestDate: null, daysUntilDrop: null, needsExportSoon: false });
    }

    const oldest       = new Date(row.oldest);
    const ageDays       = Math.floor((Date.now() - oldest.getTime()) / 86400000);
    const daysUntilDrop = RETENTION_DAYS - ageDays;

    res.json({
      oldestDate:      row.oldest,
      daysUntilDrop,
      needsExportSoon: daysUntilDrop <= 7,
    });
  } catch (err) {
    console.error("GET /lab-results/retention-status error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
