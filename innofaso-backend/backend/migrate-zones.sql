-- ════════════════════════════════════════════════
--  INNOFASO — Migration zones réelles
--  A importer via phpMyAdmin (base: innofaso)
--  ou : mysql -u root innofaso < migrate-zones.sql
-- ════════════════════════════════════════════════

USE innofaso;

-- 1. Ajouter la colonne map_id si elle n'existe pas encore
ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS map_id VARCHAR(10) NULL AFTER id;

-- 2. Vider l'historique et les zones existantes
DELETE FROM zone_history;
DELETE FROM zones;

-- 3. Remettre l'auto-increment à 1
ALTER TABLE zones        AUTO_INCREMENT = 1;
ALTER TABLE zone_history AUTO_INCREMENT = 1;

-- 4. Insérer les 21 zones réelles avec leurs map_id SVG
INSERT INTO zones (map_id, label, status, ufc, seuil, responsible, last_check, next_check, alert_cls, alert_title, alert_desc) VALUES
('z1',  'Zone 1 - Stockage Produits Finis', 'ok',       18, 50, 'Ouedraogo Paul',  '25/05/2026 06:30', '25/05/2026 14:30', 'good', 'Zone conforme',       'Niveaux de contamination dans les limites acceptables.'),
('z2',  'Zone 2 - Emballage',              'ok',       22, 50, 'Sawadogo Marie',  '25/05/2026 06:45', '25/05/2026 14:45', 'good', 'Zone conforme',       'Niveaux de contamination dans les limites acceptables.'),
('z3',  'Zone 3 - Entree emballages',      'warning',  41, 50, 'Traore Amina',    '25/05/2026 07:00', '25/05/2026 11:00', 'warn', 'Surveillance requise','Niveau proche du seuil — renforcer les controles.'),
('z4',  'Zone 4 - Laverie Buanderie',      'warning',  44, 50, 'Traore Amina',    '25/05/2026 07:10', '25/05/2026 11:10', 'warn', 'Surveillance requise','Niveau eleve — risque de depassement imminent.'),
('z5',  'Zone 5 - Conditionnement',        'ok',       25, 50, 'Sawadogo Marie',  '25/05/2026 07:20', '25/05/2026 15:20', 'good', 'Zone conforme',       'Niveaux de contamination dans les limites acceptables.'),
('z6',  'Zone 6 - Melange',                'warning',  43, 50, 'Kone Ibrahim',    '25/05/2026 07:30', '25/05/2026 11:30', 'warn', 'Surveillance requise','Niveau proche du seuil — surveiller evolution.'),
('z7',  'Zone 7 - Premelange',             'critical', 65, 50, 'Kone Ibrahim',    '25/05/2026 07:45', '25/05/2026 09:45', 'crit', 'Action requise',      'DEPASSEMENT CRITIQUE — arreter production et decontaminer immediatement.'),
('z8',  'Zone 8 - Pesee poudre',           'critical', 58, 50, 'Zongo Mariam',    '25/05/2026 08:00', '25/05/2026 10:00', 'crit', 'Action requise',      'DEPASSEMENT CRITIQUE — contamination detectee sur equipement de pesee.'),
('z9',  'Zone 9 - Salle de pompage',       'warning',  45, 50, 'Kabore Seydou',   '25/05/2026 08:15', '25/05/2026 12:15', 'warn', 'Surveillance requise','Niveau eleve — verifier etancheite des installations.'),
('z10', 'Zone 10 - SAS Sechage',           'ok',       28, 50, 'Kabore Seydou',   '25/05/2026 08:30', '25/05/2026 16:30', 'good', 'Zone conforme',       'Niveaux de contamination dans les limites acceptables.'),
('z11', 'Zone 11 - Matieres Premieres',    'ok',       15, 50, 'Compaore Jean',   '25/05/2026 08:45', '25/05/2026 16:45', 'good', 'Zone conforme',       'Niveaux de contamination dans les limites acceptables.'),
('z12', 'Zone 12 - SAS Poudres',           'warning',  42, 50, 'Zongo Mariam',    '25/05/2026 09:00', '25/05/2026 13:00', 'warn', 'Surveillance requise','Niveau proche du seuil dans le SAS — augmenter nettoyage.'),
('z13', 'Zone 13 - Chambre Froide',        'ok',       12, 50, 'Compaore Jean',   '25/05/2026 09:15', '25/05/2026 17:15', 'good', 'Zone conforme',       'Excellente maitrise en zone froide.'),
('z14', 'Zone 14 - Vestiaires F+E',        'warning',  47, 50, 'Ouedraogo Paul',  '25/05/2026 09:30', '25/05/2026 13:30', 'warn', 'Surveillance requise','Niveau eleve — verifier hygiene du personnel.'),
('z15', 'Zone 15 - Toilettes Lavabos',     'critical', 72, 50, 'Ouedraogo Paul',  '25/05/2026 09:45', '25/05/2026 11:45', 'crit', 'Action requise',      'DEPASSEMENT CRITIQUE — sanitaires contamines. Nettoyage urgence.'),
('z16', 'Zone 16 - Couloir technique',     'ok',       30, 50, 'Sawadogo Marie',  '25/05/2026 10:00', '25/05/2026 16:00', 'good', 'Zone conforme',       'Niveaux de contamination dans les limites acceptables.'),
('z17', 'Zone 17 - Compresseur Secheur',   'ok',        8, 50, 'Kabore Seydou',   '25/05/2026 10:15', '25/05/2026 16:15', 'good', 'Zone conforme',       'Zone technique — excellent niveau de proprete.'),
('z19', 'Zone 19 - Cuve 1',               'ok',        5, 50, 'Kone Ibrahim',    '25/05/2026 10:30', '25/05/2026 16:30', 'good', 'Zone conforme',       'Cuve hermetique — contamination quasi nulle.'),
('z20', 'Zone 20 - Cuve 2',               'ok',        7, 50, 'Kone Ibrahim',    '25/05/2026 10:30', '25/05/2026 16:30', 'good', 'Zone conforme',       'Cuve hermetique — contamination quasi nulle.'),
('z21', 'Zone 21 - Cuve 3',               'ok',        6, 50, 'Kone Ibrahim',    '25/05/2026 10:30', '25/05/2026 16:30', 'good', 'Zone conforme',       'Cuve hermetique — contamination quasi nulle.'),
('z22', 'Zone 22 - SAS Air',              'warning',  40, 50, 'Kabore Seydou',   '25/05/2026 11:00', '25/05/2026 15:00', 'warn', 'Surveillance requise','Seuil alerte atteint dans le SAS entree air.');

-- 5. Historique 7 jours par zone (ID 1–17 = z1–z17 | 18=z19 | 19=z20 | 20=z21 | 21=z22)
INSERT INTO zone_history (zone_id, ufc) VALUES (1,21),(1,20),(1,19),(1,17),(1,18),(1,19),(1,18);
INSERT INTO zone_history (zone_id, ufc) VALUES (2,25),(2,24),(2,23),(2,21),(2,22),(2,23),(2,22);
INSERT INTO zone_history (zone_id, ufc) VALUES (3,32),(3,35),(3,37),(3,38),(3,39),(3,41),(3,41);
INSERT INTO zone_history (zone_id, ufc) VALUES (4,36),(4,38),(4,40),(4,41),(4,42),(4,44),(4,44);
INSERT INTO zone_history (zone_id, ufc) VALUES (5,27),(5,26),(5,25),(5,24),(5,25),(5,26),(5,25);
INSERT INTO zone_history (zone_id, ufc) VALUES (6,34),(6,37),(6,38),(6,40),(6,41),(6,43),(6,43);
INSERT INTO zone_history (zone_id, ufc) VALUES (7,40),(7,45),(7,48),(7,52),(7,56),(7,60),(7,65);
INSERT INTO zone_history (zone_id, ufc) VALUES (8,38),(8,42),(8,45),(8,49),(8,52),(8,55),(8,58);
INSERT INTO zone_history (zone_id, ufc) VALUES (9,37),(9,40),(9,42),(9,43),(9,44),(9,45),(9,45);
INSERT INTO zone_history (zone_id, ufc) VALUES (10,30),(10,29),(10,28),(10,27),(10,28),(10,29),(10,28);
INSERT INTO zone_history (zone_id, ufc) VALUES (11,17),(11,16),(11,15),(11,14),(11,15),(11,16),(11,15);
INSERT INTO zone_history (zone_id, ufc) VALUES (12,33),(12,36),(12,38),(12,39),(12,40),(12,42),(12,42);
INSERT INTO zone_history (zone_id, ufc) VALUES (13,14),(13,13),(13,12),(13,11),(13,12),(13,13),(13,12);
INSERT INTO zone_history (zone_id, ufc) VALUES (14,38),(14,41),(14,43),(14,45),(14,46),(14,47),(14,47);
INSERT INTO zone_history (zone_id, ufc) VALUES (15,52),(15,56),(15,58),(15,62),(15,65),(15,68),(15,72);
INSERT INTO zone_history (zone_id, ufc) VALUES (16,32),(16,31),(16,30),(16,29),(16,30),(16,31),(16,30);
INSERT INTO zone_history (zone_id, ufc) VALUES (17,9),(17,8),(17,7),(17,8),(17,9),(17,8),(17,8);
INSERT INTO zone_history (zone_id, ufc) VALUES (18,6),(18,5),(18,5),(18,6),(18,5),(18,5),(18,5);
INSERT INTO zone_history (zone_id, ufc) VALUES (19,8),(19,7),(19,6),(19,7),(19,8),(19,7),(19,7);
INSERT INTO zone_history (zone_id, ufc) VALUES (20,7),(20,6),(20,5),(20,6),(20,7),(20,6),(20,6);
INSERT INTO zone_history (zone_id, ufc) VALUES (21,34),(21,36),(21,37),(21,38),(21,39),(21,40),(21,40);

SELECT CONCAT('Migration terminee : ', COUNT(*), ' zones inserees.') AS resultat FROM zones;
