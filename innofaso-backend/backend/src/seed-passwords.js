// Run once: node src/seed-passwords.js
// Updates the admin passwords in the database with proper bcrypt hashes

require("dotenv").config();
const bcrypt = require("bcryptjs");
const db     = require("./db");

const USERS = [
  { username: "admin",   password: "Admin2026!",  name: "Administrateur Principal", role: "superadmin" },
  { username: "qualite", password: "Qualite123!", name: "Responsable Qualité",       role: "editor" },
];

async function seed() {
  console.log("🌱 Seeding admin users...");
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await db.query(
      `INSERT INTO admin_users (username, password, name, role)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password=VALUES(password), name=VALUES(name), role=VALUES(role)`,
      [u.username, hash, u.name, u.role]
    );
    console.log(`  ✅  ${u.username} OK`);
  }
  console.log("✅ Done!");
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
