const db = require("../db");
const { recomputeZone } = require("./recomputeZone");

// ─────────────────────────────────────────────
// Identifiants de points "E.S.N" (Environnement.Salle.N°) tels que rapportés
// par les bulletins de laboratoire, ex. "1.5.3" → env="1", room=5, seq="3".
// Les points "aléatoires" créés en administration utilisent un format à 2
// segments {pointType}.{seq} (ex. "2.7") qui n'a PAS de segment Salle — ils
// ne passent donc jamais par la résolution Salle→Zone ci-dessous.
// ─────────────────────────────────────────────
function parsePointId(raw) {
  const m = String(raw || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { env: m[1], room: Number(m[2]), seq: m[3] };
}

// ─────────────────────────────────────────────
// Résout le segment Salle d'un identifiant E.S.N vers une zone de la carte,
// via la table room_zone_map. Retourne null si la salle est inconnue.
// ─────────────────────────────────────────────
async function resolveZoneForRoom(room) {
  if (room === null || room === undefined) return null;
  const [[row]] = await db.query(
    "SELECT zone_map_id FROM room_zone_map WHERE room = ?",
    [room]
  );
  return row ? row.zone_map_id : null;
}

// ─────────────────────────────────────────────
// Devine la zone d'un point à partir du texte de sa description dans le
// bulletin, quand son ID n'a pas pu être rattaché par numéro de salle (cas
// des "points aléatoires" — ID à 2 segments, qui n'ont par définition pas de
// segment Salle — ou d'un ID mal formé). Vocabulaire extrait directement des
// vrais bulletins de laboratoire (pas du fichier Excel de suivi, qui contient
// des incohérences internes de numérotation non fiables pour cet usage).
//
// L'ordre des règles compte : les expressions les plus spécifiques (2 mots)
// sont vérifiées avant les mots isolés, pour éviter les faux positifs entre
// zones qui partagent un mot (ex. "pesée" apparaît à la fois en zone Pesage
// ET en zone Huile, qui correspond en réalité à la "pesée du prémélange").
// ─────────────────────────────────────────────
const ZONE_KEYWORD_RULES = [
  { zone: "vestiaire_laverie",   test: t => t.includes("vestiaire") && t.includes("laverie") },
  { zone: "vestiaires_h",        test: t => t.includes("vestiaire") && (t.includes("homme") || t.includes("hommes")) },
  { zone: "vestiaires_f",        test: t => t.includes("vestiaire") && (t.includes("femme") || t.includes("femmes")) },
  { zone: "vestiaires_visiteur", test: t => t.includes("vestiaire") && t.includes("visiteur") },
  { zone: "laverie",             test: t => t.includes("laverie") },
  { zone: "labo_microbiologie",  test: t => t.includes("labo") || t.includes("microbiologie") },
  { zone: "sas_poudres",         test: t => t.includes("sas") },
  { zone: "conditionnement",     test: t => t.includes("conditionn") || t.includes("ensacheuse") || t.includes("convoyeur") || t.includes("carton") },
  { zone: "huile",               test: t => (t.includes("pesee") || t.includes("pesage")) && (t.includes("premelange") || t.includes("pre melange") || t.includes("pre-melange")) },
  // Zone "Huile et pesage S+A+H" = pesée des 3 ingrédients du prémélange
  // (Sucre + Arachide + Huile) — leurs noms suffisent à eux seuls, sans avoir
  // besoin du mot "pesée"/"prémélange" à côté (ex. bulletin réel : "Seau
  // utilisé pour le pesage de l'huile de palme", "Sac de sucre").
  { zone: "huile",               test: t => t.includes("sucre") || t.includes("arachide") || t.includes("huile") },
  // "Cuve tampon" est un libellé officiel exclusif au Prémélange (point
  // 1.4.1) — sans ambiguïté avec une autre zone, contrairement à "trémie"
  // (qui apparaît à la fois en Mélange et en Prémélange et n'est donc
  // volontairement pas utilisé seul comme mot-clé).
  { zone: "premix",              test: t => t.includes("cuve tampon") },
  { zone: "premix",              test: t => t.includes("premelange") || t.includes("pre melange") || t.includes("pre-melange") || t.includes("premelangeur") || t.includes("pre melangeur") },
  { zone: "melange",             test: t => t.includes("melange") && t.includes("poudre") },
  { zone: "pesage",              test: t => (t.includes("pesee") || t.includes("pesage")) && t.includes("melange") },
  // "MP" (Matière Première) est une abréviation suffisamment spécifique au
  // contexte de l'usine pour ne pas exiger en plus le mot "stockage" à côté
  // (ex. bulletin réel : "Palette en MP").
  { zone: "matieres_premieres",  test: t => t.includes("matiere premiere") || t.includes("matieres premieres") || /\bmp\b/.test(t) },
  { zone: "stockage_pf",         test: t => t.includes("produit fini") || t.includes("produits finis") || (t.includes("stockage") && /\bpf\b/.test(t)) },
  { zone: "melange",             test: t => t.includes("melange") },
];

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function guessZoneFromDescription(description) {
  const t = normalizeText(description);
  if (!t) return null;
  for (const rule of ZONE_KEYWORD_RULES) {
    if (rule.test(t)) return rule.zone;
  }
  return null;
}

// ─────────────────────────────────────────────
// Position d'un point nouvellement créé : la carte (géométrie des zones) ne
// vit que côté frontend (factoryData.js), donc on place le nouveau point près
// du centroïde de ses futurs voisins déjà connus dans la même zone, en
// éventail pour éviter d'empiler plusieurs points au même endroit.
// ─────────────────────────────────────────────
async function computeNewPointPosition(zoneMapId) {
  const [siblings] = await db.query(
    "SELECT x, y FROM sampling_points WHERE zone_map_id = ?",
    [zoneMapId]
  );
  if (siblings.length === 0) return { x: 50, y: 50 };

  const cx = siblings.reduce((s, p) => s + Number(p.x), 0) / siblings.length;
  const cy = siblings.reduce((s, p) => s + Number(p.y), 0) / siblings.length;

  const idx = siblings.length;
  const angle = (idx % 8) * (Math.PI / 4);
  const radius = 3 + Math.floor(idx / 8) * 2;
  const x = Math.min(99, Math.max(1, cx + radius * Math.cos(angle)));
  const y = Math.min(99, Math.max(1, cy + radius * Math.sin(angle)));
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

// ─────────────────────────────────────────────
// Place définitivement un point en attente (pending_points) dans la zone
// choisie — crée le point, enrichit room_zone_map (si la salle est connue),
// journalise l'historique réel s'il y a une mesure, recalcule la zone.
// Factorisé pour être appelé à la fois par la résolution manuelle (admin,
// cf. routes/pendingPoints.js) et par la résolution automatique différée
// (au démarrage du serveur, cf. server.js, sur les entrées en attente que la
// déduction par mots-clés peut désormais résoudre seule). N'efface PAS la
// ligne pending_points elle-même : à la charge de l'appelant.
// ─────────────────────────────────────────────
async function placePendingPoint(row, zoneMapId) {
  const pos = await computeNewPointPosition(zoneMapId);
  try {
    await db.query(
      "INSERT INTO sampling_points (id, zone_map_id, label, x, y, point_type, description, ufc) VALUES (?,?,?,?,?,?,?,?)",
      [row.point_id, zoneMapId, row.point_id, pos.x, pos.y, row.point_type || "1", row.description || "", row.ufc]
    );
  } catch (err) {
    if (err.code !== "ER_DUP_ENTRY") throw err;
    // Le point a été créé entre-temps (ex. réimport du même bulletin) — on
    // continue quand même pour enrichir room_zone_map et journaliser la mesure.
  }

  if (row.room !== null && row.room !== undefined) {
    await db.query(
      "INSERT INTO room_zone_map (room, zone_map_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE zone_map_id = VALUES(zone_map_id)",
      [row.room, zoneMapId]
    );
  }

  if (row.import_id !== null && (row.ufc !== null || row.salmonella_detected !== null || row.cronobacter_detected !== null)) {
    await db.query(
      "INSERT INTO point_history (point_id, import_id, ufc_before, ufc_after, salmonella_detected, cronobacter_detected, recorded_at) VALUES (?,?,?,?,?,?,?)",
      [row.point_id, row.import_id, null, row.ufc, row.salmonella_detected, row.cronobacter_detected, row.recorded_at || new Date()]
    );
  }

  await recomputeZone(zoneMapId);
}

module.exports = {
  parsePointId,
  resolveZoneForRoom,
  computeNewPointPosition,
  guessZoneFromDescription,
  placePendingPoint,
};
