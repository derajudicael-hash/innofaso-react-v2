const mysql = require("mysql2/promise");
const fs    = require("fs");
const path  = require("path");

const envPath    = path.join(__dirname, ".env");
const envExample = path.join(__dirname, ".env.example");
if (!fs.existsSync(envPath) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envPath);
  console.log(".env créé automatiquement depuis .env.example");
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

    // Migration : table sampling_points (v4)
    const [sp] = await conn.query("SHOW TABLES LIKE 'sampling_points'");
    if (sp.length === 0) {
      console.log("Création de la table sampling_points...");
      const sql = fs.readFileSync(path.join(__dirname, "database.sql"), "utf8");
      const createSP = sql.match(/CREATE TABLE IF NOT EXISTS sampling_points[\s\S]*?;/)?.[0];
      const insertSP = sql.match(/INSERT INTO sampling_points[\s\S]*?ON DUPLICATE KEY UPDATE[\s\S]*?;/)?.[0];
      if (createSP) await conn.query(createSP);
      if (insertSP) await conn.query(insertSP);
      console.log("Table sampling_points créée avec 49 points de prélèvement.");
    }
  }

  await conn.end();
  console.log(`Base de données "${dbName}" prête.`);
}

setup().catch((err) => {
  console.error("Erreur setup base de données :", err.message);
  console.error("Vérifiez que MySQL est démarré et que le .env est bien configuré.");
  process.exit(1);
});
