-- ═══════════════════════════════════════════
--  INNOFASO — Base de données v3.0
--  Usine Plumpy'Nut — La Grâce, Burkina Faso
-- ═══════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS innofaso
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE innofaso;

CREATE TABLE IF NOT EXISTS zones (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  map_id        VARCHAR(50)   NULL,
  label         VARCHAR(100)  NOT NULL,
  status        ENUM('critical','warning','ok') NOT NULL DEFAULT 'ok',
  ufc           DECIMAL(8,2)  NOT NULL DEFAULT 0,
  seuil         DECIMAL(8,2)  NOT NULL DEFAULT 50,
  seuil_manual  TINYINT(1)    NOT NULL DEFAULT 0,
  responsible   VARCHAR(100)  NOT NULL DEFAULT '',
  alert_cls     VARCHAR(10)   NOT NULL DEFAULT 'good',
  alert_title   VARCHAR(100)  NOT NULL DEFAULT 'Zone conforme',
  alert_desc    TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS zone_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  zone_id     INT NOT NULL,
  ufc         DECIMAL(8,2) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_info (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  key_name  VARCHAR(50)  NOT NULL UNIQUE,
  key_value VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  name       VARCHAR(100) NOT NULL,
  role       ENUM('superadmin','editor') NOT NULL DEFAULT 'editor',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════
--  DONNÉES INITIALES
-- ═══════════════════════════════════════

-- Champs contact (city/country/contact/phone) volontairement vides : ils ne
-- se remplissent que lorsque l'admin les saisit lui-même dans Paramètres.
INSERT INTO site_info (key_name, key_value) VALUES
('name',    'InnoFaso'),
('city',    ''),
('country', ''),
('contact', ''),
('phone',   '')
ON DUPLICATE KEY UPDATE key_value = VALUES(key_value);

INSERT INTO admin_users (username, password, name, role) VALUES
('admin',   '$2a$10$OGU2J9TqwfhDvpIChmCXGe8Ug.GBuOWq.JHYD2fbPv6Kpv0VFGOle', 'Administrateur Principal', 'superadmin'),
('qualite', '$2a$10$ZpzC8jU9CXi9kAWx497LvOOyUvZ2qE8rCeIrKiLGV79kgeBcW5era', 'Responsable Qualite',      'editor')
ON DUPLICATE KEY UPDATE password = VALUES(password), name = VALUES(name), role = VALUES(role);

-- ── 14 zones de l'usine (IDs = factory-hygiene zone IDs) ──────────────────
INSERT INTO zones (map_id, label, status, ufc, seuil, responsible, alert_cls, alert_title, alert_desc) VALUES
('stockage_pf',       'Stockage Produits Finis',  'ok',       85,  500, 'Ouedraogo Paul',    'good', 'Zone conforme',        'Niveaux dans les limites acceptables.'),
('conditionnement',   'Conditionnement',           'ok',        4,   10, 'Sawadogo Marie',    'good', 'Zone conforme',        'Excellente maîtrise de la contamination.'),
('melange',           'Mélange',                   'warning',   8,   10, 'Kone Ibrahim',      'warn', 'Surveillance requise', 'Niveau proche du seuil — renforcer les contrôles.'),
('premix',            'PreMélange',                'critical', 13,   10, 'Kone Ibrahim',      'crit', 'Action requise',       'DÉPASSEMENT — arrêter et décontaminer immédiatement.'),
('pesage',            'Pesage poudres',            'ok',        3,   10, 'Zongo Mariam',      'good', 'Zone conforme',        'Bon niveau de maîtrise.'),
('huile',             'Huile et pesage S+A+H',     'warning',   9,   10, 'Kabore Seydou',     'warn', 'Surveillance requise', 'Niveau élevé — vérifier équipements.'),
('sas_poudres',       'SAS poudres',               'ok',       45,  100, 'Zongo Mariam',      'good', 'Zone conforme',        'Niveaux dans les limites acceptables.'),
('matieres_premieres','Matières Premières',         'ok',      120,  500, 'Compaore Jean',     'good', 'Zone conforme',        'Zone grise — contamination maîtrisée.'),
('laverie',           'Laverie + buanderie',        'ok',      230,  500, 'Traore Amina',      'good', 'Zone conforme',        'Niveaux normaux pour zone laverie.'),
('vestiaire_laverie', 'Vestiaire Laverie',          'ok',      180,  500, 'Traore Amina',      'good', 'Zone conforme',        'Niveaux dans les limites.'),
('vestiaires_h',      'Vestiaires H',               'ok',      290,  500, 'Ouedraogo Paul',    'good', 'Zone conforme',        'Niveaux dans les limites.'),
('vestiaires_visiteur','Vestiaires Visiteur',        'warning', 415,  500, 'Compaore Jean',     'warn', 'Surveillance requise', 'Niveau élevé — vérifier hygiène visiteurs.'),
('vestiaires_f',      'Vestiaires F',               'ok',      150,  500, 'Sawadogo Marie',    'good', 'Zone conforme',        'Niveaux dans les limites.'),
('labo_microbiologie','Labo Microbiologie',         'ok',        0,  500, 'Zongo Mariam',      'good', 'Zone conforme',        'Niveaux dans les limites.');

-- ── Points de prélèvement ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sampling_points (
  id          VARCHAR(20)   NOT NULL PRIMARY KEY,
  zone_map_id VARCHAR(50)   NOT NULL,
  label       VARCHAR(50)   NOT NULL,
  x           DECIMAL(6,2)  NOT NULL,
  y           DECIMAL(6,2)  NOT NULL,
  point_type  CHAR(1)       NOT NULL DEFAULT '1',
  description VARCHAR(255)  NOT NULL DEFAULT '',
  ufc         DECIMAL(8,2)  DEFAULT NULL,
  seuil       DECIMAL(8,2)  DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table volontairement vide : les points de prélèvement ne sont plus codés en
-- dur. Ils sont créés automatiquement par l'import d'un bulletin (résolution
-- Salle → Zone, cf. room_zone_map ci-dessous) ou manuellement depuis le
-- panneau "Points à placer" en administration. L'import est l'unique source
-- de vérité pour cette table.

-- ── Résolution Salle → Zone (2e segment de l'identifiant E.S.N des bulletins) ──
-- Permet de créer automatiquement un nouveau point de prélèvement quand un
-- bulletin rapporte un identifiant inconnu (ex. "1.5.12") dont le numéro de
-- salle (segment S, ici 5) correspond à une salle déjà cartographiée.
CREATE TABLE IF NOT EXISTS room_zone_map (
  room        INT          NOT NULL PRIMARY KEY,
  zone_map_id VARCHAR(50)  NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO room_zone_map (room, zone_map_id) VALUES
(1,  'pesage'),
(2,  'melange'),
(3,  'huile'),
(4,  'premix'),
(5,  'conditionnement'),
(6,  'sas_poudres'),
(11, 'matieres_premieres'),
(12, 'stockage_pf'),
(13, 'laverie'),
(14, 'vestiaires_h'),
(15, 'vestiaires_f'),
(16, 'vestiaires_visiteur'),
(17, 'labo_microbiologie'),
(18, 'vestiaire_laverie')
ON DUPLICATE KEY UPDATE zone_map_id = VALUES(zone_map_id);

-- ── Journal des imports de bulletins + historique par point ────────────────
-- Fondation de la refonte de l'historique (juin 2026) : sert à la fois aux
-- courbes par point (une ligne par point fixe) et a l'annulation d'un import
-- (avant/apres par point). Demarre vide volontairement (reset decide avec
-- l'utilisateur) : aucune donnee de seed ici.
CREATE TABLE IF NOT EXISTS import_batches (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  filename      VARCHAR(255) NOT NULL,
  imported_by   VARCHAR(100) NOT NULL,
  imported_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  result_count  INT NOT NULL DEFAULT 0,
  status        ENUM('actif','annule') NOT NULL DEFAULT 'actif',
  cancelled_at  TIMESTAMP NULL DEFAULT NULL,
  cancelled_by  VARCHAR(100) NULL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS point_history (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  point_id              VARCHAR(20) NOT NULL,
  import_id             INT NULL,
  ufc_before            DECIMAL(8,2) NULL,
  ufc_after             DECIMAL(8,2) NULL,
  salmonella_detected   TINYINT(1) NULL,
  -- Cronobacter (Enterobacter sakazakii) : pathogène de surveillance le plus
  -- spécifiquement critique pour un RUTF (référentiels WHO/UNICEF/Codex),
  -- au même titre que Salmonelles.
  cronobacter_detected  TINYINT(1) NULL,
  recorded_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (import_id) REFERENCES import_batches(id) ON DELETE CASCADE,
  -- Volontairement PAS de ON DELETE CASCADE ici (défaut = RESTRICT) : un point
  -- ayant un historique de mesures réelles ne doit pas pouvoir être supprimé
  -- silencieusement avec ses mesures. cf. routes/points.js DELETE /:id.
  FOREIGN KEY (point_id)  REFERENCES sampling_points(id),
  INDEX idx_point_recorded (point_id, recorded_at)
);

-- ── Points en attente de placement ──────────────────────────────────────
-- Un identifiant de bulletin dont la salle (2e segment de l'ID E.S.N) ne
-- correspond à aucune zone connue dans room_zone_map (ou dont l'ID ne suit
-- même pas ce format) atterrit ici au lieu d'être ignoré silencieusement.
-- Résolu manuellement en administration : choisir sa zone crée le point
-- (et enrichit room_zone_map pour les imports suivants), ou l'entrée est
-- ignorée. La ligne est supprimée une fois traitée (placée ou ignorée) —
-- pas d'état "résolu" à conserver. Démarre vide, aucune donnée de seed ici.
CREATE TABLE IF NOT EXISTS pending_points (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  point_id            VARCHAR(20)   NOT NULL,
  room                INT           NULL,
  point_type          CHAR(1)       NULL,
  description          VARCHAR(255)  NOT NULL DEFAULT '',
  ufc                  DECIMAL(8,2)  NULL,
  seuil                DECIMAL(8,2)  NULL,
  salmonella_detected  TINYINT(1)    NULL,
  cronobacter_detected TINYINT(1)    NULL,
  import_id            INT           NULL,
  recorded_at          TIMESTAMP     NULL DEFAULT NULL,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (import_id) REFERENCES import_batches(id) ON DELETE CASCADE,
  INDEX idx_point (point_id)
);

-- ── Historique 7 jours ───────────────────────────────────────────────────
INSERT INTO zone_history (zone_id, ufc) VALUES (1,90),(1,88),(1,86),(1,84),(1,87),(1,85),(1,85);
INSERT INTO zone_history (zone_id, ufc) VALUES (2,5),(2,6),(2,4),(2,5),(2,4),(2,4),(2,4);
INSERT INTO zone_history (zone_id, ufc) VALUES (3,5),(3,6),(3,7),(3,7),(3,8),(3,8),(3,8);
INSERT INTO zone_history (zone_id, ufc) VALUES (4,8),(4,9),(4,10),(4,11),(4,12),(4,13),(4,13);
INSERT INTO zone_history (zone_id, ufc) VALUES (5,4),(5,3),(5,3),(5,4),(5,3),(5,3),(5,3);
INSERT INTO zone_history (zone_id, ufc) VALUES (6,6),(6,7),(6,8),(6,8),(6,9),(6,9),(6,9);
INSERT INTO zone_history (zone_id, ufc) VALUES (7,38),(7,40),(7,42),(7,43),(7,44),(7,45),(7,45);
INSERT INTO zone_history (zone_id, ufc) VALUES (8,125),(8,122),(8,118),(8,121),(8,120),(8,120),(8,120);
INSERT INTO zone_history (zone_id, ufc) VALUES (9,220),(9,225),(9,228),(9,232),(9,230),(9,230),(9,230);
INSERT INTO zone_history (zone_id, ufc) VALUES (10,185),(10,182),(10,180),(10,178),(10,180),(10,180),(10,180);
INSERT INTO zone_history (zone_id, ufc) VALUES (11,280),(11,285),(11,290),(11,288),(11,292),(11,290),(11,290);
INSERT INTO zone_history (zone_id, ufc) VALUES (12,380),(12,390),(12,400),(12,405),(12,410),(12,415),(12,415);
INSERT INTO zone_history (zone_id, ufc) VALUES (13,155),(13,152),(13,150),(13,148),(13,150),(13,150),(13,150);
INSERT INTO zone_history (zone_id, ufc) VALUES (14,0),(14,0),(14,0),(14,0),(14,0),(14,0),(14,0);
