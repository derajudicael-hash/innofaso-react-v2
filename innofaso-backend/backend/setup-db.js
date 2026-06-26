const mysql   = require("mysql2/promise");
const bcrypt  = require("bcryptjs");
const fs      = require("fs");
const path    = require("path");
const crypto  = require("crypto");

const envPath    = path.join(__dirname, ".env");
const envExample = path.join(__dirname, ".env.example");
if (!fs.existsSync(envPath) && fs.existsSync(envExample)) {
  let envContent = fs.readFileSync(envExample, "utf8");
  // Génère un secret fort unique à chaque installation plutôt que de copier
  // le placeholder "change_this_secret" du dépôt (server.js refuse de
  // démarrer avec ce placeholder — voir garde-fou en tête de server.js).
  const jwtSecret = crypto.randomBytes(48).toString("hex");
  envContent = envContent.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${jwtSecret}`);
  fs.writeFileSync(envPath, envContent);
  console.log(".env créé automatiquement depuis .env.example (JWT_SECRET généré aléatoirement)");
}

require("dotenv").config({ path: envPath });

async function setup() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  const dbName = DB_NAME || "innofaso";

  console.log(`Connexion à MySQL (${DB_HOST || "localhost"})...`);

  const conn = await mysql.createConnection({
    host:     DB_HOST     || "localhost",
    port:     DB_PORT     || 3306,
    user:     DB_USER     || "root",
    password: DB_PASSWORD || "",
    multipleStatements: true,
  });

  console.log(`Création de la base de données "${dbName}" si elle n'existe pas...`);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${dbName}\``);

  const [tables] = await conn.query("SHOW TABLES");

  if (tables.length === 0) {
    // Première installation
    const sql = fs.readFileSync(path.join(__dirname, "database.sql"), "utf8");
    console.log("Import du fichier database.sql...");
    await conn.query(sql);
    console.log("Tables et données créées avec succès.");
  } else {
    // Vérifier si on a les nouvelles zones (v3) ou les anciennes (v1/v2)
    const [existing] = await conn.query(
      "SELECT 1 FROM zones WHERE map_id = 'stockage_pf' LIMIT 1"
    );
    if (existing.length === 0) {
      console.log("Migration des zones vers le format v3 (factory-hygiene)...");
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      await conn.query("TRUNCATE TABLE zone_history");
      await conn.query("TRUNCATE TABLE zones");
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      // Insérer les nouvelles zones
      const sql = fs.readFileSync(path.join(__dirname, "database.sql"), "utf8");
      // Extraire uniquement les INSERT INTO zones et zone_history
      const insertZones    = sql.match(/INSERT INTO zones[\s\S]*?;/g) || [];
      const insertHistory  = sql.match(/INSERT INTO zone_history[\s\S]*?;/g) || [];
      const insertThresh   = sql.match(/INSERT INTO thresholds[\s\S]*?;/g) || [];
      const insertSite     = sql.match(/INSERT INTO site_info[\s\S]*?;/g) || [];
      for (const q of [...insertThresh, ...insertSite, ...insertZones, ...insertHistory]) {
        await conn.query(q);
      }
      console.log("Migration zones terminée (13 zones factory-hygiene).");
    } else {
      console.log(`Base de données "${dbName}" déjà à jour.`);
    }

    // Migration : table sampling_points (v4) — vide, alimentée par l'import des bulletins
    const [sp] = await conn.query("SHOW TABLES LIKE 'sampling_points'");
    if (sp.length === 0) {
      console.log("Création de la table sampling_points (vide — alimentée par l'import)...");
      const sql = fs.readFileSync(path.join(__dirname, "database.sql"), "utf8");
      const createSP = sql.match(/CREATE TABLE IF NOT EXISTS sampling_points[\s\S]*?;/)?.[0];
      if (createSP) await conn.query(createSP);
      console.log("Table sampling_points créée.");
    }

    // Migration : import_batches + point_history (historique par point)
    const [ib] = await conn.query("SHOW TABLES LIKE 'import_batches'");
    if (ib.length === 0) {
      console.log("Création des tables import_batches et point_history...");
      const sql = fs.readFileSync(path.join(__dirname, "database.sql"), "utf8");
      const createIB = sql.match(/CREATE TABLE IF NOT EXISTS import_batches[\s\S]*?;/)?.[0];
      const createPH = sql.match(/CREATE TABLE IF NOT EXISTS point_history[\s\S]*?;/)?.[0];
      if (createIB) await conn.query(createIB);
      if (createPH) await conn.query(createPH);
      console.log("Tables import_batches et point_history créées.");
    }

    // Migration : room_zone_map + pending_points (résolution Salle→Zone)
    const [rzm] = await conn.query("SHOW TABLES LIKE 'room_zone_map'");
    if (rzm.length === 0) {
      console.log("Création des tables room_zone_map et pending_points...");
      const sql = fs.readFileSync(path.join(__dirname, "database.sql"), "utf8");
      const createRZM = sql.match(/CREATE TABLE IF NOT EXISTS room_zone_map[\s\S]*?;/)?.[0];
      const insertRZM = sql.match(/INSERT INTO room_zone_map[\s\S]*?ON DUPLICATE KEY UPDATE[\s\S]*?;/)?.[0];
      const createPP  = sql.match(/CREATE TABLE IF NOT EXISTS pending_points[\s\S]*?;/)?.[0];
      if (createRZM) await conn.query(createRZM);
      if (insertRZM) await conn.query(insertRZM);
      if (createPP)  await conn.query(createPP);
      console.log("Tables room_zone_map (14 salles) et pending_points créées.");
    }
  }

  // Création/mise à jour des comptes avec hashes bcrypt frais (idempotent)
  const USERS = [
    { username: "admin",   password: "Admin2026!",  name: "Administrateur Principal", role: "superadmin" },
    { username: "qualite", password: "Qualite123!", name: "Responsable Qualité",       role: "editor" },
  ];
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await conn.query(
      `INSERT INTO admin_users (username, password, name, role)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password=VALUES(password), name=VALUES(name), role=VALUES(role)`,
      [u.username, hash, u.name, u.role]
    );
  }

  await conn.end();
  console.log(`\n✅  Base de données "${dbName}" prête.\n`);
  console.log("┌─────────────────────────────────────────────┐");
  console.log("│  Comptes de connexion par défaut :           │");
  console.log("│                                              │");
  console.log("│  Superadmin : admin     /  Admin2026!        │");
  console.log("│  Éditeur    : qualite   /  Qualite123!       │");
  console.log("│                                              │");
  console.log("│  Démarrez l'application : npm run dev        │");
  console.log("└─────────────────────────────────────────────┘\n");
}

setup().catch((err) => {
  console.error("Erreur setup base de données :", err.message);
  console.error("Vérifiez que MySQL est démarré et que le .env est bien configuré.");
  process.exit(1);
});
