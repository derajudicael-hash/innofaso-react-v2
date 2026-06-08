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

// ── Init DB tables (idempotent) ───────────────
const db = require("./db");
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
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
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
