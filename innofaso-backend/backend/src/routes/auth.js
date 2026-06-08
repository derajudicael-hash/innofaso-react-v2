const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const db      = require("../db");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Identifiant et mot de passe requis." });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM admin_users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// POST /api/auth/change-password
router.post("/change-password", require("../middleware/auth"), async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    const [rows] = await db.query("SELECT * FROM admin_users WHERE id = ?", [userId]);
    if (rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable." });

    const valid = await bcrypt.compare(oldPassword, rows[0].password);
    if (!valid) return res.status(401).json({ error: "Mot de passe actuel incorrect." });

    if (newPassword.length < 8)
      return res.status(400).json({ error: "Minimum 8 caractères requis." });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE admin_users SET password = ? WHERE id = ?", [hash, userId]);

    res.json({ message: "Mot de passe modifié avec succès." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
