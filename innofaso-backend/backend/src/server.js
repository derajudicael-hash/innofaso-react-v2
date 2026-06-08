require("dotenv").config();
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

const DEFAULT_POINTS = [
  { id: '4.12.1',   zone_map_id: 'stockage_pf',        label: '4.12.1',   x: 11,   y: 55,   point_type: '4', description: 'Sol Stockage Tampon PF' },
  { id: '1.5.1',    zone_map_id: 'conditionnement',     label: '1.5.1',    x: 26.5, y: 17.5, point_type: '1', description: 'Surface interne trémie conditionnement 1' },
  { id: '1.5.2',    zone_map_id: 'conditionnement',     label: '1.5.2',    x: 26.5, y: 24.5, point_type: '1', description: 'Surface interne trémie conditionnement 2' },
  { id: '1.5.3',    zone_map_id: 'conditionnement',     label: '1.5.3',    x: 26.5, y: 31.5, point_type: '1', description: 'Surface interne trémie conditionnement 4' },
  { id: '1.5.4',    zone_map_id: 'conditionnement',     label: '1.5.4',    x: 26.5, y: 38.5, point_type: '1', description: 'Col formateur conditionneuse 1' },
  { id: '1.5.6',    zone_map_id: 'conditionnement',     label: '1.5.6',    x: 26.5, y: 45.5, point_type: '1', description: 'Col formateur conditionneuse L4A' },
  { id: '1.5.3r',   zone_map_id: 'conditionnement',     label: '1.5.3',    x: 36.5, y: 17.5, point_type: '1', description: 'Surface interne trémie conditionnement 4 (R)' },
  { id: '1.5.6r',   zone_map_id: 'conditionnement',     label: '1.5.6',    x: 36.5, y: 24.5, point_type: '1', description: 'Col formateur L4A (R)' },
  { id: '1.5.7',    zone_map_id: 'conditionnement',     label: '1.5.7',    x: 36.5, y: 31.5, point_type: '1', description: 'Col formateur conditionneuse L4B' },
  { id: '1.5.8',    zone_map_id: 'conditionnement',     label: '1.5.8',    x: 36.5, y: 38.5, point_type: '1', description: 'Canne dosage ensacheuses 1' },
  { id: '2.5.1',    zone_map_id: 'conditionnement',     label: '2.5.1',    x: 30.5, y: 57,   point_type: '2', description: 'Scotcheuse automatique' },
  { id: '3.5.1',    zone_map_id: 'conditionnement',     label: '3.5.1',    x: 30.5, y: 70,   point_type: '3', description: 'Tapis convoyeur conditionnement' },
  { id: '1.2.1',    zone_map_id: 'melange',             label: '1.2.1',    x: 45.5, y: 22,   point_type: '1', description: 'Surface internes trémie incorporation mélange' },
  { id: '1.2.2',    zone_map_id: 'melange',             label: '1.2.2',    x: 52.0, y: 22,   point_type: '1', description: 'Ouverture vanne filtre mélange poudre' },
  { id: '2.2.1',    zone_map_id: 'melange',             label: '2.2.1',    x: 45.5, y: 33,   point_type: '2', description: 'Extérieur du mélangeur poudre' },
  { id: '3.2.2',    zone_map_id: 'melange',             label: '3.2.2',    x: 52.0, y: 40,   point_type: '3', description: 'Mur zone de mélange poudre' },
  { id: '3.2.1',    zone_map_id: 'melange',             label: '3.2.1',    x: 46.5, y: 56,   point_type: '3', description: 'Sol zone de mélange poudre' },
  { id: '1.4.1',    zone_map_id: 'premix',              label: '1.4.1',    x: 59.5, y: 10.5, point_type: '1', description: 'Paroi interne cuve tampon prémélange' },
  { id: '1.4.2',    zone_map_id: 'premix',              label: '1.4.2',    x: 66.0, y: 10.5, point_type: '1', description: 'Surface internes trémie incorporation prémélange' },
  { id: '2.4.1',    zone_map_id: 'premix',              label: '2.4.1',    x: 59.5, y: 28,   point_type: '2', description: 'Extérieur du pré mélangeur' },
  { id: '3.4.2',    zone_map_id: 'premix',              label: '3.4.2',    x: 67.0, y: 28,   point_type: '3', description: 'Escabot en pré mélange' },
  { id: '1.1.1',    zone_map_id: 'pesage',              label: '1.1.1',    x: 58.5, y: 56,   point_type: '1', description: 'Couteaux salle de pesée mélange' },
  { id: '2.1.2',    zone_map_id: 'pesage',              label: '2.1.2',    x: 65.0, y: 56,   point_type: '2', description: 'Plateau balance pesée mélange' },
  { id: '2.1.1',    zone_map_id: 'pesage',              label: '2.1.1',    x: 58.5, y: 65.5, point_type: '2', description: 'Bras aspirante dust-collector' },
  { id: '2.1.4',    zone_map_id: 'pesage',              label: '2.1.4',    x: 65.0, y: 65.5, point_type: '2', description: 'Coffret porte rapide pesée mélange' },
  { id: '3.1.1',    zone_map_id: 'pesage',              label: '3.1.1',    x: 61.5, y: 72.5, point_type: '3', description: 'Palette plastique pesée mélange (lait)' },
  { id: '1.3.1',    zone_map_id: 'huile',               label: '1.3.1',    x: 74.5, y: 18,   point_type: '1', description: 'Seau en pesée prémélange' },
  { id: '2.3.1a',   zone_map_id: 'huile',               label: '2.3.1',    x: 74.5, y: 30,   point_type: '2', description: 'Plateau balance pesée pré mélange' },
  { id: '2.3.1b',   zone_map_id: 'huile',               label: '2.3.1',    x: 81.0, y: 30,   point_type: '2', description: 'Plateau balance pesée pré mélange (bis)' },
  { id: '3.3.1',    zone_map_id: 'huile',               label: '3.3.1',    x: 81.0, y: 42,   point_type: '3', description: 'Palette plastique pesée prémélange' },
  { id: '3.6.2',    zone_map_id: 'sas_poudres',         label: '3.6.2',    x: 74.5, y: 63,   point_type: '3', description: 'Mur SAS mélange poudre' },
  { id: '3.6.1',    zone_map_id: 'sas_poudres',         label: '3.6.1',    x: 80.5, y: 70,   point_type: '3', description: 'Sol SAS mélange poudre' },
  { id: '4.11.2',   zone_map_id: 'matieres_premieres',  label: '4.11.2',   x: 94,   y: 22,   point_type: '4', description: 'Zone de prélèvement matières premières (Hôte)' },
  { id: '4.11.1',   zone_map_id: 'matieres_premieres',  label: '4.11.1',   x: 94,   y: 57,   point_type: '4', description: 'Sol Stockage Tampon MP' },
  { id: '4.13.3',   zone_map_id: 'laverie',             label: '4.13.3',   x: 25.5, y: 82,   point_type: '4', description: 'Zone de séchage matériel propre' },
  { id: '4.13.1',   zone_map_id: 'laverie',             label: '4.13.1',   x: 31.5, y: 90,   point_type: '4', description: 'Sol laverie' },
  { id: '4.13.2',   zone_map_id: 'laverie',             label: '4.13.2',   x: 38.5, y: 86,   point_type: '4', description: 'Bassin laverie' },
  { id: '4.18.1',   zone_map_id: 'vestiaire_laverie',   label: '4.18.1',   x: 5.5,  y: 82,   point_type: '4', description: 'Poigné vestiaire laverie' },
  { id: '4.18.2',   zone_map_id: 'vestiaire_laverie',   label: '4.18.2',   x: 5.5,  y: 90,   point_type: '4', description: 'Sol vestiaire laverie' },
  { id: '4.18.3',   zone_map_id: 'vestiaire_laverie',   label: '4.18.3',   x: 13.5, y: 86,   point_type: '4', description: 'Distributeur vestiaire laverie' },
  { id: '4.14.1',   zone_map_id: 'vestiaires_h',        label: '4.14.1',   x: 45.5, y: 82.5, point_type: '4', description: 'Banc homme' },
  { id: '4.14.2a',  zone_map_id: 'vestiaires_h',        label: '4.14.2',   x: 51.5, y: 82.5, point_type: '4', description: 'Poignet vestiaire homme' },
  { id: '4.14.2b',  zone_map_id: 'vestiaires_h',        label: '4.14.2',   x: 48.5, y: 92,   point_type: '4', description: 'Poignet vestiaire homme (bis)' },
  { id: '4.16.3a',  zone_map_id: 'vestiaires_visiteur', label: '4.16.3',   x: 58.5, y: 82.5, point_type: '4', description: 'Sols de vestiaire visiteur' },
  { id: '4.16.1',   zone_map_id: 'vestiaires_visiteur', label: '4.16.1',   x: 65.0, y: 82.5, point_type: '4', description: 'Banc visiteur' },
  { id: '4.16.3b',  zone_map_id: 'vestiaires_visiteur', label: '4.16.3',   x: 61.5, y: 92,   point_type: '4', description: 'Sols vestiaire visiteur (bis)' },
  { id: '4.15.1',   zone_map_id: 'vestiaires_f',        label: '4.15.1',   x: 71.5, y: 82.5, point_type: '4', description: 'Banc femme' },
  { id: '4.15.2',   zone_map_id: 'vestiaires_f',        label: '4.15.2',   x: 78.0, y: 82.5, point_type: '4', description: 'Poignet vestiaire femme' },
  { id: '4.15.3',   zone_map_id: 'vestiaires_f',        label: '4.15.3',   x: 74.5, y: 92,   point_type: '4', description: 'Sols de vestiaire femme' },
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
    const [[{ cnt }]] = await db.query("SELECT COUNT(*) AS cnt FROM sampling_points");
    if (cnt === 0) {
      for (const p of DEFAULT_POINTS) {
        await db.query(
          "INSERT INTO sampling_points (id, zone_map_id, label, x, y, point_type, description) VALUES (?,?,?,?,?,?,?)",
          [p.id, p.zone_map_id, p.label, p.x, p.y, p.point_type, p.description]
        );
      }
      console.log(`✅  ${DEFAULT_POINTS.length} points de prélèvement initialisés en base.`);
    }

    // Seed des zones basées sur les zones carte (une par zone physique)
    const MAP_ZONES_SEED = [
      { map_id: 'stockage_pf',         label: 'Stockage Produits Finis',  seuil: 50 },
      { map_id: 'conditionnement',     label: 'Conditionnement',           seuil: 50 },
      { map_id: 'melange',             label: 'Mélange',                   seuil: 50 },
      { map_id: 'premix',              label: 'PreMélange',                seuil: 50 },
      { map_id: 'pesage',              label: 'Pesage poudres',            seuil: 50 },
      { map_id: 'huile',               label: 'Huile et pesage S+A+H',    seuil: 50 },
      { map_id: 'sas_poudres',         label: 'SAS poudres',              seuil: 50 },
      { map_id: 'matieres_premieres',  label: 'Matières Premières',       seuil: 50 },
      { map_id: 'laverie',             label: 'Laverie + buanderie',      seuil: 50 },
      { map_id: 'vestiaire_laverie',   label: 'Vestiaire Laverie',        seuil: 50 },
      { map_id: 'vestiaires_h',        label: 'Vestiaires H',             seuil: 50 },
      { map_id: 'vestiaires_visiteur', label: 'Vestiaires Visiteur',      seuil: 50 },
      { map_id: 'vestiaires_f',        label: 'Vestiaires F',             seuil: 50 },
    ];
    for (const z of MAP_ZONES_SEED) {
      const [[{ zc }]] = await db.query("SELECT COUNT(*) AS zc FROM zones WHERE map_id = ?", [z.map_id]);
      if (zc === 0) {
        await db.query(
          `INSERT INTO zones (label, map_id, status, ufc, seuil, responsible, last_check, next_check, alert_cls, alert_title, alert_desc)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [z.label, z.map_id, 'ok', 0, z.seuil, 'Non assigné',
           new Date().toLocaleDateString('fr-FR'), '—',
           'good', 'Zone conforme', 'Niveaux dans les limites acceptables']
        );
      }
    }
    console.log("✅  Zones carte vérifiées/initialisées en base.");
  } catch (e) {
    console.warn("DB init warning:", e.message);
  }
})();

// ── Routes ────────────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/zones",    require("./routes/zones"));
app.use("/api/points",   require("./routes/points"));
app.use("/api/settings", require("./routes/settings"));

// ── Health check ─────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() }));

// ── 404 ──────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route introuvable." }));

// ── Start ─────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅  InnoFaso API démarrée sur http://localhost:${PORT}`);
});
