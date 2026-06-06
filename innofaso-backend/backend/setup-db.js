const mysql = require("mysql2/promise");
const fs    = require("fs");
const path  = require("path");

const envPath     = path.join(__dirname, ".env");
const envExample  = path.join(__dirname, ".env.example");
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
  if (tables.length > 0) {
    console.log(`Base de données "${dbName}" déjà initialisée (${tables.length} tables). Import ignoré.`);
  } else {
    const sqlFile = path.join(__dirname, "database.sql");
    console.log("Import du fichier database.sql...");
    const sql = fs.readFileSync(sqlFile, "utf8");
    await conn.query(sql);
    console.log("Tables créées avec succès.");
  }

  await conn.end();
  console.log(`Base de données "${dbName}" prête.`);
}

setup().catch((err) => {
  console.error("Erreur setup base de données :", err.message);
  console.error("Vérifiez que MySQL est démarré et que le .env est bien configuré.");
  process.exit(1);
});
