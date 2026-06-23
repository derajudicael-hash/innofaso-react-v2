require("dotenv").config();

const JWT_PLACEHOLDER = "change_this_secret";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === JWT_PLACEHOLDER) {
  console.error("❌  JWT_SECRET manquant ou laissé à la valeur par défaut du dépôt.");
  console.error("    Définissez une valeur secrète forte et unique dans le fichier .env avant de démarrer le serveur.");
  process.exit(1);
}

const express = require("express");
const cors    = require("cors");

const app = express();

// ── Middleware ────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  process.env.MAP_URL      || "http://localhost:3000",
];
app.use(cors({
  origin:      (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
}));
app.use(express.json());

// ── Init DB tables + seed (idempotent) ────────
const db = require("./db");

// Anciens IDs avec suffixe a/b qui ne correspondaient à aucun identifiant réel des
// bulletins (le bulletin rapporte l'ID nu, ex. "2.3.1", jamais "2.3.1a"). On renomme
// la variante "a" vers l'ID nu et on garde "b" comme doublon de localisation (bis).
const ID_RENAMES = [
  { from: '2.3.1a',  to: '2.3.1'  },
  { from: '4.14.2a', to: '4.14.2' },
  { from: '4.16.3a', to: '4.16.3' },
];

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS sampling_points (
        id          VARCHAR(20)   NOT NULL PRIMARY KEY,
        zone_map_id VARCHAR(50)   NOT NULL,
        label       VARCHAR(50)   NOT NULL,
        x           DECIMAL(6,2)  NOT NULL,
        y           DECIMAL(6,2)  NOT NULL,
        point_type  CHAR(1)       NOT NULL DEFAULT '1',
        description VARCHAR(255)  NOT NULL DEFAULT '',
        ufc         DECIMAL(8,2)  DEFAULT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Ajoute la colonne ufc si la table existait avant cette feature
    try {
      await db.query("ALTER TABLE sampling_points ADD COLUMN ufc DECIMAL(8,2) DEFAULT NULL");
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.warn("ALTER ufc:", e.message);
    }
    // Seuil propre au point, extrait de la colonne "Spécifications" du bulletin
    // (cf. lib/recomputeZone.js) — alimente automatiquement le seuil de la
    // zone tant que l'admin ne l'a pas fixé à la main (zones.seuil_manual).
    try {
      await db.query("ALTER TABLE sampling_points ADD COLUMN seuil DECIMAL(8,2) DEFAULT NULL");
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.warn("ALTER sampling_points.seuil:", e.message);
    }
    try {
      await db.query("ALTER TABLE zones ADD COLUMN seuil_manual TINYINT(1) NOT NULL DEFAULT 0");
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.warn("ALTER zones.seuil_manual:", e.message);
    }
    // "Dernier contrôle"/"Prochain contrôle" : champs de saisie libre sans
    // logique réelle derrière — retirés (juin 2026).
    try {
      await db.query("ALTER TABLE zones DROP COLUMN last_check");
    } catch (e) {
      if (!e.message.includes("check that it exists")) console.warn("DROP zones.last_check:", e.message);
    }
    try {
      await db.query("ALTER TABLE zones DROP COLUMN next_check");
    } catch (e) {
      if (!e.message.includes("check that it exists")) console.warn("DROP zones.next_check:", e.message);
    }
    // Migration : renomme les anciens IDs à suffixe a/b vers l'ID nu attendu par les bulletins.
    // Idempotent : si l'ID cible existe déjà (déjà migré) ou si la source n'existe plus, on ignore.
    for (const r of ID_RENAMES) {
      try {
        const [[{ already }]] = await db.query("SELECT COUNT(*) AS already FROM sampling_points WHERE id = ?", [r.to]);
        if (already === 0) {
          await db.query("UPDATE sampling_points SET id = ? WHERE id = ?", [r.to, r.from]);
        }
      } catch (e) {
        console.warn(`Migration rename ${r.from}->${r.to}:`, e.message);
      }
    }

    // Plus de seed figé ici : les points sont créés par l'import des bulletins
    // (résolution Salle → Zone, cf. lib/pointResolution.js) ou manuellement
    // depuis le panneau "Points à placer" en administration.

    // Fondation de l'historique par point (courbes par point + annulation d'import)
    await db.query(`
      CREATE TABLE IF NOT EXISTS import_batches (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        filename      VARCHAR(255) NOT NULL,
        imported_by   VARCHAR(100) NOT NULL,
        imported_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        result_count  INT NOT NULL DEFAULT 0,
        status        ENUM('actif','annule') NOT NULL DEFAULT 'actif',
        cancelled_at  TIMESTAMP NULL DEFAULT NULL,
        cancelled_by  VARCHAR(100) NULL DEFAULT NULL
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS point_history (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        point_id             VARCHAR(20) NOT NULL,
        import_id            INT NULL,
        ufc_before           DECIMAL(8,2) NULL,
        ufc_after            DECIMAL(8,2) NULL,
        salmonella_detected  TINYINT(1) NULL,
        cronobacter_detected TINYINT(1) NULL,
        recorded_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (import_id) REFERENCES import_batches(id) ON DELETE CASCADE,
        FOREIGN KEY (point_id)  REFERENCES sampling_points(id),
        INDEX idx_point_recorded (point_id, recorded_at)
      )
    `);
    // Migration : ajoute la colonne si la table existait avant ce correctif.
    try {
      await db.query("ALTER TABLE point_history ADD COLUMN cronobacter_detected TINYINT(1) NULL");
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.warn("ALTER point_history.cronobacter_detected:", e.message);
    }

    // Migration : une base déjà initialisée avant ce correctif a la contrainte
    // point_id en ON DELETE CASCADE — supprimer un point effaçait silencieusement
    // ses mesures réelles. On la recrée en RESTRICT (défaut) si besoin.
    const [fkRows] = await db.query(`
      SELECT CONSTRAINT_NAME, DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'point_history'
        AND REFERENCED_TABLE_NAME = 'sampling_points'
    `);
    const fk = fkRows[0];
    if (fk && fk.DELETE_RULE === 'CASCADE') {
      await db.query(`ALTER TABLE point_history DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      await db.query(`ALTER TABLE point_history ADD FOREIGN KEY (point_id) REFERENCES sampling_points(id)`);
      console.log("✅  Contrainte point_history.point_id passée en RESTRICT (protection de l'historique).");
    }

    // Résolution Salle → Zone (segment S des identifiants E.S.N des bulletins)
    // + points en attente de placement (salle inconnue, ou ID ne suivant même
    // pas le format E.S.N) — jamais ignorés silencieusement, cf. routes/pendingPoints.js.
    //
    // pending_points a été ébauchée avec un schéma plus riche (reason/status/
    // resolved_*) avant d'être simplifiée — si un précédent démarrage a déjà
    // créé l'ancien schéma (table forcément encore vide, fonctionnalité jamais
    // branchée à une UI), on la recrée proprement plutôt que de migrer colonne
    // par colonne une table sans aucune donnée réelle.
    const [[oldSchema]] = await db.query("SHOW COLUMNS FROM pending_points LIKE 'reason'").catch(() => [[null]]);
    if (oldSchema) await db.query("DROP TABLE pending_points");

    await db.query(`
      CREATE TABLE IF NOT EXISTS room_zone_map (
        room        INT          NOT NULL PRIMARY KEY,
        zone_map_id VARCHAR(50)  NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS pending_points (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        point_id             VARCHAR(20)   NOT NULL,
        room                 INT           NULL,
        point_type           CHAR(1)       NULL,
        description          VARCHAR(255)  NOT NULL DEFAULT '',
        ufc                  DECIMAL(8,2)  NULL,
        salmonella_detected  TINYINT(1)    NULL,
        cronobacter_detected TINYINT(1)    NULL,
        import_id            INT           NULL,
        recorded_at          TIMESTAMP     NULL DEFAULT NULL,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (import_id) REFERENCES import_batches(id) ON DELETE CASCADE,
        INDEX idx_point (point_id)
      )
    `);
    try {
      await db.query("ALTER TABLE pending_points ADD COLUMN cronobacter_detected TINYINT(1) NULL");
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.warn("ALTER pending_points.cronobacter_detected:", e.message);
    }
    try {
      await db.query("ALTER TABLE pending_points ADD COLUMN seuil DECIMAL(8,2) DEFAULT NULL");
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.warn("ALTER pending_points.seuil:", e.message);
    }

    const ROOM_ZONE_SEED = [
      [1, 'pesage'], [2, 'melange'], [3, 'huile'], [4, 'premix'],
      [5, 'conditionnement'], [6, 'sas_poudres'], [11, 'matieres_premieres'],
      [12, 'stockage_pf'], [13, 'laverie'], [14, 'vestiaires_h'],
      [15, 'vestiaires_f'], [16, 'vestiaires_visiteur'],
      [17, 'labo_microbiologie'], [18, 'vestiaire_laverie'],
    ];
    for (const [room, zoneMapId] of ROOM_ZONE_SEED) {
      await db.query(
        "INSERT INTO room_zone_map (room, zone_map_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE zone_map_id = VALUES(zone_map_id)",
        [room, zoneMapId]
      );
    }

    // Rattrapage : la déduction de zone par mots-clés (guessZoneFromDescription)
    // n'existait pas encore quand certaines entrées en attente ont été créées —
    // on retente leur résolution automatique à chaque démarrage, pour ne pas
    // laisser à l'admin des points que le système sait désormais placer seul.
    const { resolvePointZone, placePendingPoint } = require("./lib/pointResolution");
    const [stuckPending] = await db.query("SELECT * FROM pending_points");
    let autoResolved = 0;
    for (const row of stuckPending) {
      const { zoneMapId } = await resolvePointZone(row.point_id, row.description);
      if (!zoneMapId) continue;
      await placePendingPoint(row, zoneMapId);
      await db.query("DELETE FROM pending_points WHERE id = ?", [row.id]);
      autoResolved++;
    }
    if (autoResolved > 0) {
      console.log(`✅  ${autoResolved} point(s) en attente résolu(s) automatiquement (salle/mots-clés).`);
    }

    // Fonctionnalités abandonnées (juin 2026) : actions correctives et lots
    // de production — suppression définitive des tables si elles existent
    // encore d'un démarrage précédent.
    await db.query("DROP TABLE IF EXISTS corrective_actions");
    await db.query("DROP TABLE IF EXISTS production_batches");

    // Seed des zones basées sur les zones carte (une par zone physique)
    // Seuils conformes NF EN ISO 18593 / EC 2073/2005 :
    //   Type 1 (surfaces en contact direct produit) = 10 UFC/cm²
    //   Type 2 (surfaces en contact indirect)        = 50 UFC/cm²
    //   Type 3 (surfaces sans contact alimentaire)   = 100 UFC/cm²
    //   Type 4 (zones périphériques / environnement) = 500 UFC/cm²
    // Pour chaque zone, le seuil retenu est celui du type de point le plus restrictif présent.
    const MAP_ZONES_SEED = [
      { map_id: 'stockage_pf',         label: 'Stockage Produits Finis',  seuil: 500 }, // type 4 uniquement
      { map_id: 'conditionnement',     label: 'Conditionnement',           seuil: 10  }, // types 1+2+3 → type 1 dominant
      { map_id: 'melange',             label: 'Mélange',                   seuil: 10  }, // types 1+2+3 → type 1 dominant
      { map_id: 'premix',              label: 'Pré-Mélange',               seuil: 10  }, // types 1+2+3 → type 1 dominant
      { map_id: 'pesage',              label: 'Pesage poudres',            seuil: 10  }, // types 1+2+3 → type 1 dominant
      { map_id: 'huile',               label: 'Huile et pesage S+A+H',    seuil: 10  }, // types 1+2+3 → type 1 dominant
      { map_id: 'sas_poudres',         label: 'SAS poudres',              seuil: 100 }, // type 3 uniquement
      { map_id: 'matieres_premieres',  label: 'Matières Premières',       seuil: 500 }, // type 4 uniquement
      { map_id: 'laverie',             label: 'Laverie + buanderie',      seuil: 500 }, // type 4 uniquement
      { map_id: 'vestiaire_laverie',   label: 'Vestiaire Laverie',        seuil: 500 }, // type 4 uniquement
      { map_id: 'vestiaires_h',        label: 'Vestiaires H',             seuil: 500 }, // type 4 uniquement
      { map_id: 'vestiaires_visiteur', label: 'Vestiaires Visiteur',      seuil: 500 }, // type 4 uniquement
      { map_id: 'vestiaires_f',        label: 'Vestiaires F',             seuil: 500 }, // type 4 uniquement
      { map_id: 'labo_microbiologie',  label: 'Labo Microbiologie',      seuil: 500 }, // type 4 uniquement
    ];
    // Seuil de départ uniquement pour une zone qui n'existe pas encore — une
    // fois créée, son seuil suit le bulletin (ou l'admin), jamais réécrit ici.
    for (const z of MAP_ZONES_SEED) {
      const [[{ zc }]] = await db.query("SELECT COUNT(*) AS zc FROM zones WHERE map_id = ?", [z.map_id]);
      if (zc === 0) {
        await db.query(
          `INSERT INTO zones (label, map_id, status, ufc, seuil, responsible, alert_cls, alert_title, alert_desc)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [z.label, z.map_id, 'ok', 0, z.seuil, 'Non assigné',
           'good', 'Zone conforme', 'Niveaux dans les limites acceptables']
        );
      }
    }
    console.log("✅  Zones carte vérifiées/initialisées en base.");

    // InnoFaso est désormais le nom générique de la plateforme, plus celui
    // d'une usine en particulier — et les coordonnées de contact ne doivent
    // se remplir que lorsqu'un admin les saisit lui-même. Migration unique :
    // ne touche que si la valeur est encore le seed d'origine (placeholder
    // jamais personnalisé), pour ne jamais écraser une vraie saisie admin.
    await db.query(
      "UPDATE site_info SET key_value = 'InnoFaso' WHERE key_name = 'name' AND key_value = 'Usine Plumpy-Nut La Grace'"
    );
    await db.query(
      "UPDATE site_info SET key_value = '' WHERE key_name = 'contact' AND key_value = 'qualite@lagrace.bf'"
    );
    await db.query(
      "UPDATE site_info SET key_value = '' WHERE key_name = 'phone' AND key_value = '+226 25 38 00 00'"
    );

    // Rattrapage (juin 2026) : avant le fix de recomputeZone() (cf. lib/
    // recomputeZone.js), seul zones.ufc était mis à jour après un import
    // automatique — status/alert_cls/alert_title/alert_desc restaient figés
    // sur leur dernière valeur fixée manuellement. Recalcule une fois pour
    // toutes les zones existantes à partir de leur ufc/seuil déjà en base,
    // pour ne pas laisser une zone affichée "conforme" alors qu'elle dépasse
    // déjà son seuil. Sans effet sur une base où le statut est déjà exact.
    const { computeStatus, ALERT_MAP } = require("./lib/recomputeZone");
    const [allZones] = await db.query("SELECT id, ufc, seuil, status FROM zones");
    for (const z of allZones) {
      const correctStatus = computeStatus(Number(z.ufc), Number(z.seuil));
      if (correctStatus !== z.status) {
        const alert = ALERT_MAP[correctStatus];
        await db.query(
          "UPDATE zones SET status = ?, alert_cls = ?, alert_title = ?, alert_desc = ? WHERE id = ?",
          [correctStatus, alert.alert_cls, alert.alert_title, alert.alert_desc, z.id]
        );
      }
    }
  } catch (e) {
    console.warn("DB init warning:", e.message);
  }
})();

// ── Routes ────────────────────────────────────
app.use("/api/auth",       require("./routes/auth"));
app.use("/api/zones",      require("./routes/zones"));
app.use("/api/points",     require("./routes/points"));
app.use("/api/settings",   require("./routes/settings"));
app.use("/api/lab-results", require("./routes/labResults"));
app.use("/api/pending-points", require("./routes/pendingPoints"));

// ── Health check ─────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() }));

// ── 404 ──────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route introuvable." }));

// ── Start ─────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅  InnoFaso API démarrée sur http://localhost:${PORT}`);
});
