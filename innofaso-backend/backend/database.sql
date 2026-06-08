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

-- ── Points de prélèvement ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sampling_points (
  id          VARCHAR(20)   NOT NULL PRIMARY KEY,
  zone_map_id VARCHAR(50)   NOT NULL,
  label       VARCHAR(50)   NOT NULL,
  x           DECIMAL(6,2)  NOT NULL,
  y           DECIMAL(6,2)  NOT NULL,
  point_type  CHAR(1)       NOT NULL DEFAULT '1',
  description VARCHAR(255)  NOT NULL DEFAULT '',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sampling_points (id, zone_map_id, label, x, y, point_type, description) VALUES
('4.12.1',   'stockage_pf',        '4.12.1',  11.00, 55.00, '4', 'Sol Stockage Tampon PF'),
('1.5.1',    'conditionnement',    '1.5.1',   26.50, 17.50, '1', 'Surface interne trémie conditionnement 1'),
('1.5.2',    'conditionnement',    '1.5.2',   26.50, 24.50, '1', 'Surface interne trémie conditionnement 2'),
('1.5.3',    'conditionnement',    '1.5.3',   26.50, 31.50, '1', 'Surface interne trémie conditionnement 4'),
('1.5.4',    'conditionnement',    '1.5.4',   26.50, 38.50, '1', 'Col formateur conditionneuse 1'),
('1.5.6',    'conditionnement',    '1.5.6',   26.50, 45.50, '1', 'Col formateur conditionneuse L4A'),
('1.5.3r',   'conditionnement',    '1.5.3',   36.50, 17.50, '1', 'Surface interne trémie conditionnement 4 (R)'),
('1.5.6r',   'conditionnement',    '1.5.6',   36.50, 24.50, '1', 'Col formateur L4A (R)'),
('1.5.7',    'conditionnement',    '1.5.7',   36.50, 31.50, '1', 'Col formateur conditionneuse L4B'),
('1.5.8',    'conditionnement',    '1.5.8',   36.50, 38.50, '1', 'Canne dosage ensacheuses 1'),
('2.5.1',    'conditionnement',    '2.5.1',   30.50, 57.00, '2', 'Scotcheuse automatique'),
('3.5.1',    'conditionnement',    '3.5.1',   30.50, 70.00, '3', 'Tapis convoyeur conditionnement'),
('1.2.1',    'melange',            '1.2.1',   45.50, 22.00, '1', 'Surface internes trémie incorporation mélange'),
('1.2.2',    'melange',            '1.2.2',   52.00, 22.00, '1', 'Ouverture vanne filtre mélange poudre'),
('2.2.1',    'melange',            '2.2.1',   45.50, 33.00, '2', 'Extérieur du mélangeur poudre'),
('3.2.2',    'melange',            '3.2.2',   52.00, 40.00, '3', 'Mur zone de mélange poudre'),
('3.2.1',    'melange',            '3.2.1',   46.50, 56.00, '3', 'Sol zone de mélange poudre'),
('1.4.1',    'premix',             '1.4.1',   59.50, 10.50, '1', 'Paroi interne cuve tampon prémélange'),
('1.4.2',    'premix',             '1.4.2',   66.00, 10.50, '1', 'Surface internes trémie incorporation prémélange'),
('2.4.1',    'premix',             '2.4.1',   59.50, 28.00, '2', 'Extérieur du pré mélangeur'),
('3.4.2',    'premix',             '3.4.2',   67.00, 28.00, '3', 'Escabot en pré mélange'),
('1.1.1',    'pesage',             '1.1.1',   58.50, 56.00, '1', 'Couteaux salle de pesée mélange'),
('2.1.2',    'pesage',             '2.1.2',   65.00, 56.00, '2', 'Plateau balance pesée mélange'),
('2.1.1',    'pesage',             '2.1.1',   58.50, 65.50, '2', 'Bras aspirante dust-collector'),
('2.1.4',    'pesage',             '2.1.4',   65.00, 65.50, '2', 'Coffret porte rapide pesée mélange'),
('3.1.1',    'pesage',             '3.1.1',   61.50, 72.50, '3', 'Palette plastique pesée mélange (lait)'),
('1.3.1',    'huile',              '1.3.1',   74.50, 18.00, '1', 'Seau en pesée prémélange'),
('2.3.1a',   'huile',              '2.3.1',   74.50, 30.00, '2', 'Plateau balance pesée pré mélange'),
('2.3.1b',   'huile',              '2.3.1',   81.00, 30.00, '2', 'Plateau balance pesée pré mélange (bis)'),
('3.3.1',    'huile',              '3.3.1',   81.00, 42.00, '3', 'Palette plastique pesée prémélange'),
('3.6.2',    'sas_poudres',        '3.6.2',   74.50, 63.00, '3', 'Mur SAS mélange poudre'),
('3.6.1',    'sas_poudres',        '3.6.1',   80.50, 70.00, '3', 'Sol SAS mélange poudre'),
('4.11.2',   'matieres_premieres', '4.11.2',  94.00, 22.00, '4', 'Zone de prélèvement matières premières (Hôte)'),
('4.11.1',   'matieres_premieres', '4.11.1',  94.00, 57.00, '4', 'Sol Stockage Tampon MP'),
('4.13.3',   'laverie',            '4.13.3',  25.50, 82.00, '4', 'Zone de séchage matériel propre'),
('4.13.1',   'laverie',            '4.13.1',  31.50, 90.00, '4', 'Sol laverie'),
('4.13.2',   'laverie',            '4.13.2',  38.50, 86.00, '4', 'Bassin laverie'),
('4.18.1',   'vestiaire_laverie',  '4.18.1',   5.50, 82.00, '4', 'Poigné vestiaire laverie'),
('4.18.2',   'vestiaire_laverie',  '4.18.2',   5.50, 90.00, '4', 'Sol vestiaire laverie'),
('4.18.3',   'vestiaire_laverie',  '4.18.3',  13.50, 86.00, '4', 'Distributeur vestiaire laverie'),
('4.14.1',   'vestiaires_h',       '4.14.1',  45.50, 82.50, '4', 'Banc homme'),
('4.14.2a',  'vestiaires_h',       '4.14.2',  51.50, 82.50, '4', 'Poignet vestiaire homme'),
('4.14.2b',  'vestiaires_h',       '4.14.2',  48.50, 92.00, '4', 'Poignet vestiaire homme (bis)'),
('4.16.3a',  'vestiaires_visiteur','4.16.3',  58.50, 82.50, '4', 'Sols de vestiaire visiteur'),
('4.16.1',   'vestiaires_visiteur','4.16.1',  65.00, 82.50, '4', 'Banc visiteur'),
('4.16.3b',  'vestiaires_visiteur','4.16.3',  61.50, 92.00, '4', 'Sols vestiaire visiteur (bis)'),
('4.15.1',   'vestiaires_f',       '4.15.1',  71.50, 82.50, '4', 'Banc femme'),
('4.15.2',   'vestiaires_f',       '4.15.2',  78.00, 82.50, '4', 'Poignet vestiaire femme'),
('4.15.3',   'vestiaires_f',       '4.15.3',  74.50, 92.00, '4', 'Sols de vestiaire femme')
ON DUPLICATE KEY UPDATE label=VALUES(label);

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
