const express = require("express");
const db      = require("../db");
const auth             = require("../middleware/auth");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Fenêtre glissante de l'historique par point (cf. refonte historique juin 2026)
const RETENTION_DAYS = 30;

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

// Recalcule l'UFC max d'une zone à partir de ses points mesurés, journalise
// zone_history (purge 90 jours) et met à jour zones.ufc — utilisé après tout
// import ou toute annulation d'import qui touche les points de cette zone.
async function recomputeZone(zoneMapId) {
  const [[zoneRow]] = await db.query("SELECT id FROM zones WHERE map_id = ?", [zoneMapId]);
  if (!zoneRow) return;

  const [pts] = await db.query(
    "SELECT ufc FROM sampling_points WHERE zone_map_id = ? AND ufc IS NOT NULL",
    [zoneMapId]
  );
  const maxUfc = pts.length > 0 ? Math.max(...pts.map(p => Number(p.ufc))) : 0;

  await db.query("INSERT INTO zone_history (zone_id, ufc) VALUES (?, ?)", [zoneRow.id, maxUfc]);
  await db.query(
    "DELETE FROM zone_history WHERE zone_id = ? AND recorded_at < DATE_SUB(NOW(), INTERVAL 90 DAY)",
    [zoneRow.id]
  );
  await db.query("UPDATE zones SET ufc = ? WHERE id = ?", [maxUfc, zoneRow.id]);
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
      } else if (r.numericValue !== undefined && r.numericValue !== null) {
        entry.ufc = r.numericValue;
      }
    }

    const unmatchedIds = [];
    const touchedZones = new Set();
    const touches = []; // { pointId, ufcBefore, ufcAfter, salmonella }
    let updatedCount = 0;

    for (const [pointId, entry] of byPoint) {
      const [[row]] = await db.query(
        "SELECT zone_map_id, ufc FROM sampling_points WHERE id = ?",
        [pointId]
      );

      if (!row) {
        unmatchedIds.push(pointId);
        continue;
      }

      const ufcBefore = row.ufc !== null ? Number(row.ufc) : null;
      const hasUfc     = entry.ufc !== undefined && entry.ufc !== null;
      const ufcAfter   = hasUfc ? entry.ufc : ufcBefore;

      if (hasUfc) {
        await db.query("UPDATE sampling_points SET ufc = ? WHERE id = ?", [ufcAfter, pointId]);
        updatedCount++;
      }

      touchedZones.add(row.zone_map_id);
      touches.push({ pointId, ufcBefore, ufcAfter, salmonella: entry.salmonella ?? null });
    }

    let importId = null;
    if (touches.length > 0) {
      const [batch] = await db.query(
        "INSERT INTO import_batches (filename, imported_by, result_count) VALUES (?, ?, ?)",
        [filename || "bulletin", req.user?.name || req.user?.username || "admin", results.length]
      );
      importId = batch.insertId;

      for (const t of touches) {
        await db.query(
          "INSERT INTO point_history (point_id, import_id, ufc_before, ufc_after, salmonella_detected, recorded_at) VALUES (?,?,?,?,?,?)",
          [t.pointId, importId, t.ufcBefore, t.ufcAfter, t.salmonella, reportDate]
        );
      }
    }

    for (const zoneMapId of touchedZones) {
      await recomputeZone(zoneMapId);
    }

    res.json({
      message: "Résultats importés avec succès",
      count: results.length,
      updated: updatedCount,
      unmatchedIds,
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
// POST /api/lab-results/:importId/undo — annule un import (superadmin)
//
// Règle de sécurité (décidée avec l'utilisateur) : restaure la valeur d'avant
// import pour chaque point touché, SAUF si un import plus récent a déjà
// retouché ce même point — dans ce cas on retire seulement les points de
// courbe ajoutés par l'import annulé, sans écraser une donnée plus récente.
// Toujours disponible, quelle que soit l'ancienneté de l'import.
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
        "SELECT id FROM point_history WHERE point_id = ? AND id > ? LIMIT 1",
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

      // L'import annulé ne doit plus apparaître dans les courbes, peu importe
      // le cas (restauré ou conservé).
      await db.query("DELETE FROM point_history WHERE id = ?", [row.id]);
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
// GET /api/lab-results/history?zoneMapId=... — courbes par point d'une zone
// (lecture publique, comme GET /api/zones et GET /api/points)
//
// Purge au passage les relevés de plus de 30 jours (fenêtre glissante) —
// le frontend doit avertir l'utilisateur AVANT que ça n'arrive via
// GET /retention-status.
//
// La fenêtre de 30 jours est une politique de STOCKAGE (durée pendant
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
    await db.query(
      `DELETE ph FROM point_history ph
       JOIN import_batches ib ON ib.id = ph.import_id
       WHERE ib.imported_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [RETENTION_DAYS]
    );

    const [rows] = await db.query(
      `SELECT ph.point_id, ph.ufc_after, ph.salmonella_detected, ph.recorded_at,
              sp.label, sp.description, sp.point_type
       FROM point_history ph
       JOIN sampling_points sp ON sp.id = ph.point_id
       WHERE sp.zone_map_id = ?
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
        ufc:        r.ufc_after !== null ? Number(r.ufc_after) : null,
        salmonella: r.salmonella_detected === null ? null : !!r.salmonella_detected,
        date:       r.recorded_at,
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
