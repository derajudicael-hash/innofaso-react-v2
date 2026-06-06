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
  responsible   VARCHAR(100)  NOT NULL DEFAULT '',
  last_check    VARCHAR(50)   NOT NULL DEFAULT '',
  next_check    VARCHAR(50)   NOT NULL DEFAULT '',
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

CREATE TABLE IF NOT EXISTS thresholds (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(50)  NOT NULL UNIQUE,
  value      DECIMAL(8,2) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

INSERT INTO thresholds (name, value) VALUES
('critical', 50),
('warning',  40)
ON DUPLICATE KEY UPDATE value = VALUES(value);

INSERT INTO site_info (key_name, key_value) VALUES
('name',    'Usine Plumpy-Nut La Grace'),
('city',    'Ouagadougou'),
('country', 'Burkina Faso'),
('contact', 'qualite@lagrace.bf'),
('phone',   '+226 25 38 00 00')
ON DUPLICATE KEY UPDATE key_value = VALUES(key_value);

INSERT INTO admin_users (username, password, name, role) VALUES
('admin',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrateur Principal', 'superadmin'),
('qualite', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Responsable Qualite',      'editor')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ── 13 zones de l'usine (IDs = factory-hygiene zone IDs) ──────────────────
INSERT INTO zones (map_id, label, status, ufc, seuil, responsible, last_check, next_check, alert_cls, alert_title, alert_desc) VALUES
('stockage_pf',       'Stockage Produits Finis',  'ok',       85,  500, 'Ouedraogo Paul',    '06/06/2026 06:30', '06/06/2026 14:30', 'good', 'Zone conforme',        'Niveaux dans les limites acceptables.'),
('conditionnement',   'Conditionnement',           'ok',        4,   10, 'Sawadogo Marie',    '06/06/2026 06:45', '06/06/2026 14:45', 'good', 'Zone conforme',        'Excellente maîtrise de la contamination.'),
('melange',           'Mélange',                   'warning',   8,   10, 'Kone Ibrahim',      '06/06/2026 07:00', '06/06/2026 11:00', 'warn', 'Surveillance requise', 'Niveau proche du seuil — renforcer les contrôles.'),
('premix',            'PreMélange',                'critical', 13,   10, 'Kone Ibrahim',      '06/06/2026 07:15', '06/06/2026 09:15', 'crit', 'Action requise',       'DÉPASSEMENT — arrêter et décontaminer immédiatement.'),
('pesage',            'Pesage poudres',            'ok',        3,   10, 'Zongo Mariam',      '06/06/2026 07:30', '06/06/2026 15:30', 'good', 'Zone conforme',        'Bon niveau de maîtrise.'),
('huile',             'Huile et pesage S+A+H',     'warning',   9,   10, 'Kabore Seydou',     '06/06/2026 07:45', '06/06/2026 11:45', 'warn', 'Surveillance requise', 'Niveau élevé — vérifier équipements.'),
('sas_poudres',       'SAS poudres',               'ok',       45,  100, 'Zongo Mariam',      '06/06/2026 08:00', '06/06/2026 16:00', 'good', 'Zone conforme',        'Niveaux dans les limites acceptables.'),
('matieres_premieres','Matières Premières',         'ok',      120,  500, 'Compaore Jean',     '06/06/2026 08:15', '06/06/2026 16:15', 'good', 'Zone conforme',        'Zone grise — contamination maîtrisée.'),
('laverie',           'Laverie + buanderie',        'ok',      230,  500, 'Traore Amina',      '06/06/2026 08:30', '06/06/2026 16:30', 'good', 'Zone conforme',        'Niveaux normaux pour zone laverie.'),
('vestiaire_laverie', 'Vestiaire Laverie',          'ok',      180,  500, 'Traore Amina',      '06/06/2026 08:45', '06/06/2026 16:45', 'good', 'Zone conforme',        'Niveaux dans les limites.'),
('vestiaires_h',      'Vestiaires H',               'ok',      290,  500, 'Ouedraogo Paul',    '06/06/2026 09:00', '06/06/2026 17:00', 'good', 'Zone conforme',        'Niveaux dans les limites.'),
('vestiaires_visiteur','Vestiaires Visiteur',        'warning', 415,  500, 'Compaore Jean',     '06/06/2026 09:15', '06/06/2026 13:15', 'warn', 'Surveillance requise', 'Niveau élevé — vérifier hygiène visiteurs.'),
('vestiaires_f',      'Vestiaires F',               'ok',      150,  500, 'Sawadogo Marie',    '06/06/2026 09:30', '06/06/2026 17:30', 'good', 'Zone conforme',        'Niveaux dans les limites.');

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
