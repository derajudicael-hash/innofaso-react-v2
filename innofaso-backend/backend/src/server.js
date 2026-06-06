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

// ── Routes ────────────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/zones",    require("./routes/zones"));
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
