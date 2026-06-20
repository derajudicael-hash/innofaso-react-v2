// ─────────────────────────────────────────────────────────────────────────
// Pixel-accurate measurements from the 1515×490 factory floor image
// Reference columns (% of 1515):
//   outer-left=0, stockage-right=22.3, cond-right=43.0,
//   melange-right=56.1, premix-right=72.3, huile-right=83.8,
//   sas-right=88.6, mat-prem-left=88.6, outer-right=100
// Reference rows (% of 490):
//   top=0, floor-top=4.3, blue-zones-bottom=77.6,
//   vestiaire-bottom=100
// ─────────────────────────────────────────────────────────────────────────

export const ZONES = [

  // ── GREY LEFT: Stockage PF ──────────────────────────────────────────
  {
    id: 'stockage_pf',
    name: 'Stokage Produits Finis',
    area: '78m²',
    category: 'grey',
    x: 0, y: 4.3, width: 22.3, height: 73.3,
    points: [
      { id: '4.12.1', label: '4.12.1', x: 11, y: 55, pointType: '4', description: 'Sol Stockage Tampon PF' },
    ]
  },

  // ── WHITE: Conditionnement ──────────────────────────────────────────
  {
    id: 'conditionnement',
    name: 'Conditionnement',
    area: '80m²',
    category: 'white',
    x: 22.3, y: 10.2, width: 20.7, height: 67.4,
    points: [
      // Left column: 1.5.1 → 1.5.6
      { id: '1.5.1', label: '1.5.1', x: 26.5, y: 17.5, pointType: '1', description: 'Surface interne trémie conditionnement 1' },
      { id: '1.5.2', label: '1.5.2', x: 26.5, y: 24.5, pointType: '1', description: 'Surface interne trémie conditionnement 2' },
      { id: '1.5.3', label: '1.5.3', x: 26.5, y: 31.5, pointType: '1', description: 'Surface interne trémie conditionnement 4' },
      { id: '1.5.4', label: '1.5.4', x: 26.5, y: 38.5, pointType: '1', description: 'Col formateur conditionneuse 1' },
      { id: '1.5.6', label: '1.5.6', x: 26.5, y: 45.5, pointType: '1', description: 'Col formateur conditionneuse L4A' },
      { id: '1.5.9', label: '1.5.9', x: 26.5, y: 52.5, pointType: '1', description: 'Canne de dosage des ensacheuses 2' },
      { id: '1.5.11', label: '1.5.11', x: 26.5, y: 59.5, pointType: '1', description: 'Canne de dosage des ensacheuses L4B' },
      // Right column: 1.5.3, 1.5.6, 1.5.7, 1.5.8
      { id: '1.5.3r', label: '1.5.3', x: 36.5, y: 17.5, pointType: '1', description: 'Surface interne trémie conditionnement 4 (R)' },
      { id: '1.5.6r', label: '1.5.6', x: 36.5, y: 24.5, pointType: '1', description: 'Col formateur L4A (R)' },
      { id: '1.5.7', label: '1.5.7', x: 36.5, y: 31.5, pointType: '1', description: 'Col formateur conditionneuse L4B' },
      { id: '1.5.8', label: '1.5.8', x: 36.5, y: 38.5, pointType: '1', description: 'Canne dosage ensacheuses 1' },
      { id: '1.5.5', label: '1.5.5', x: 36.5, y: 45.5, pointType: '1', description: 'Col formateur de la conditionneuse 2' },
      { id: '1.5.10', label: '1.5.10', x: 36.5, y: 52.5, pointType: '1', description: 'Canne de dosage des ensacheuses L4A' },
      { id: '2.5.1', label: '2.5.1', x: 30.5, y: 57,   pointType: '2', description: 'Scotcheuse automatique' },
      { id: '2.5.2', label: '2.5.2', x: 36.5, y: 59.5, pointType: '2', description: 'Armoire de commande en zone de production' },
      { id: '2.5.3', label: '2.5.3', x: 26.5, y: 66.5, pointType: '2', description: 'Tapis du convoyeur L1' },
      { id: '3.5.1', label: '3.5.1', x: 30.5, y: 70,   pointType: '3', description: 'Tapis convoyeur conditionnement' },
      { id: '3.5.2', label: '3.5.2', x: 36.5, y: 66.5, pointType: '3', description: 'Bureau chef de quart' },
      { id: '3.5.3', label: '3.5.3', x: 30.5, y: 74,   pointType: '3', description: 'Interrupteur zone production conditionnement' },
    ]
  },

  // ── WHITE: Mélange ──────────────────────────────────────────────────
  {
    id: 'melange',
    name: 'Mélange',
    area: '32m²',
    category: 'white',
    x: 43.0, y: 16.3, width: 13.1, height: 51.3,
    points: [
      { id: '1.2.1', label: '1.2.1', x: 45.5, y: 22,   pointType: '1', description: 'Surface internes trémie incorporation mélange' },
      { id: '1.2.2', label: '1.2.2', x: 52.0, y: 22,   pointType: '1', description: 'Ouverture vanne filtre mélange poudre' },
      { id: '1.2.3', label: '1.2.3', x: 52.0, y: 27.5, pointType: '1', description: "Mains d'un opérateur mélange poudre" },
      { id: '2.2.1', label: '2.2.1', x: 45.5, y: 33,   pointType: '2', description: 'Extérieur du mélangeur poudre' },
      { id: '2.2.2', label: '2.2.2', x: 45.5, y: 40,   pointType: '2', description: 'Grille de soufflage CTA mélange poudre' },
      { id: '2.2.3', label: '2.2.3', x: 52.0, y: 47.5, pointType: '2', description: 'Grille de reprise CTA mélange poudre' },
      { id: '2.2.4', label: '2.2.4', x: 45.5, y: 47.5, pointType: '2', description: 'Distributeur de désinfectant pour main (Entrée Salle mélange)' },
      { id: '3.2.2', label: '3.2.2', x: 52.0, y: 40,   pointType: '3', description: 'Mur zone de mélange poudre' },
      { id: '3.2.1', label: '3.2.1', x: 46.5, y: 56,   pointType: '3', description: 'Sol zone de mélange poudre' },
      { id: '3.2.3', label: '3.2.3', x: 52.0, y: 56,   pointType: '3', description: 'Outils de nettoyage en zone de mélange poudre' },
      { id: '3.2.4', label: '3.2.4', x: 45.5, y: 62,   pointType: '3', description: 'Uniforme des opérateurs mélange poudre' },
      { id: '3.2.5', label: '3.2.5', x: 52.0, y: 62,   pointType: '3', description: 'Chaussures des opérateurs mélange poudre' },
    ]
  },

  // ── WHITE: PreMélange ───────────────────────────────────────────────
  {
    id: 'premix',
    name: 'PreMélange',
    area: '32m²',
    category: 'white',
    x: 56.1, y: 4.3, width: 16.2, height: 47.3,
    points: [
      { id: '1.4.1', label: '1.4.1', x: 59.5, y: 10.5, pointType: '1', description: 'Paroi interne cuve tampon prémélange' },
      { id: '1.4.2', label: '1.4.2', x: 66.0, y: 10.5, pointType: '1', description: 'Surface internes trémie incorporation prémélange' },
      { id: '2.4.1', label: '2.4.1', x: 59.5, y: 28,   pointType: '2', description: 'Extérieur du pré mélangeur' },
      { id: '3.4.1', label: '3.4.1', x: 66.0, y: 40,   pointType: '3', description: 'Clé à ergot des broyeurs prémélange' },
      { id: '3.4.2', label: '3.4.2', x: 67.0, y: 28,   pointType: '3', description: 'Escabot en pré mélange' },
    ]
  },

  // ── WHITE: Pesage poudres ───────────────────────────────────────────
  {
    id: 'pesage',
    name: 'Pesage poudres',
    area: '14m²',
    category: 'white',
    x: 56.1, y: 51.6, width: 16.2, height: 26,
    points: [
      { id: '1.1.1', label: '1.1.1', x: 58.5, y: 56,   pointType: '1', description: 'Couteaux salle de pesée mélange' },
      { id: '2.1.2', label: '2.1.2', x: 65.0, y: 56,   pointType: '2', description: 'Plateau balance pesée mélange' },
      { id: '2.1.1', label: '2.1.1', x: 58.5, y: 65.5, pointType: '2', description: 'Bras aspirante dust-collector' },
      { id: '2.1.3', label: '2.1.3', x: 61.5, y: 60.5, pointType: '2', description: 'Manche (corde) porte rapide pesée mélange' },
      { id: '2.1.4', label: '2.1.4', x: 65.0, y: 65.5, pointType: '2', description: 'Coffret porte rapide pesée mélange' },
      { id: '3.1.1', label: '3.1.1', x: 61.5, y: 72.5, pointType: '3', description: 'Palette plastique pesée mélange (lait)' },
    ]
  },

  // ── WHITE: Huile et pesage S+A+H ───────────────────────────────────
  {
    id: 'huile',
    name: 'Huile et pesage S+A+H',
    area: '23m²',
    category: 'white',
    x: 72.3, y: 10.2, width: 11.5, height: 47.4,
    points: [
      { id: '1.3.1',  label: '1.3.1',  x: 74.5, y: 18,   pointType: '1', description: 'Seau en pesée prémélange' },
      { id: '2.3.1',  label: '2.3.1',  x: 74.5, y: 30,   pointType: '2', description: 'Plateau balance pesée pré mélange' },
      { id: '2.3.1b', label: '2.3.1',  x: 81.0, y: 30,   pointType: '2', description: 'Plateau balance pesée pré mélange (bis)' },
      { id: '3.3.1',  label: '3.3.1',  x: 81.0, y: 42,   pointType: '3', description: 'Palette plastique pesée prémélange' },
      { id: '3.3.2',  label: '3.3.2',  x: 74.5, y: 42,   pointType: '3', description: 'Support des outils de nettoyage de pesée prémélange' },
    ]
  },

  // ── WHITE: SAS poudres ──────────────────────────────────────────────
  {
    id: 'sas_poudres',
    name: 'SAS poudres',
    area: '7m²',
    category: 'white',
    x: 72.3, y: 57.6, width: 11.5, height: 20,
    points: [
      { id: '3.6.2', label: '3.6.2', x: 74.5, y: 63, pointType: '3', description: 'Mur SAS mélange poudre' },
      { id: '3.6.1', label: '3.6.1', x: 80.5, y: 70, pointType: '3', description: 'Sol SAS mélange poudre' },
    ]
  },

  // ── GREY RIGHT: Matières Premières ─────────────────────────────────
  {
    id: 'matieres_premieres',
    name: 'Matières Première',
    area: '80m²',
    category: 'grey',
    x: 88.6, y: 4.3, width: 11.4, height: 73.3,
    points: [
      { id: '4.11.2', label: '4.11.2', x: 94, y: 22, pointType: '4', description: 'Zone de prélèvement matières premières (Hôte)' },
      { id: '4.11.1', label: '4.11.1', x: 94, y: 57, pointType: '4', description: 'Sol Stockage Tampon MP' },
    ]
  },

  // ── LAVERIE (yellow) ────────────────────────────────────────────────
  {
    id: 'laverie',
    name: 'Laverie + buanderie',
    area: '21m²',
    category: 'laverie',
    x: 22.3, y: 77.6, width: 20.7, height: 22.4,
    points: [
      { id: '4.13.3', label: '4.13.3', x: 25.5, y: 82, pointType: '4', description: 'Zone de séchage matériel propre' },
      { id: '4.13.1', label: '4.13.1', x: 31.5, y: 90, pointType: '4', description: 'Sol laverie' },
      { id: '4.13.2', label: '4.13.2', x: 38.5, y: 86, pointType: '4', description: 'Bassin laverie' },
    ]
  },

  // ── VESTIAIRE LAVERIE / external left bottom ────────────────────────
  {
    id: 'vestiaire_laverie',
    name: 'Vestiaire Laverie',
    category: 'external',
    x: 0, y: 77.6, width: 22.3, height: 22.4,
    points: [
      { id: '4.18.1', label: '4.18.1', x: 5.5,  y: 82,  pointType: '4', description: 'Poigné vestiaire laverie' },
      { id: '4.18.2', label: '4.18.2', x: 5.5,  y: 90,  pointType: '4', description: 'Sol vestiaire laverie' },
      { id: '4.18.3', label: '4.18.3', x: 13.5, y: 86,  pointType: '4', description: 'Distributeur vestiaire laverie' },
      { id: '4.18.4', label: '4.18.4', x: 13.5, y: 94,  pointType: '4', description: 'Chariot laverie' },
      { id: '4.18.5', label: '4.18.5', x: 5.5,  y: 96,  pointType: '4', description: 'Poudre du dust collector' },
    ]
  },

  // ── VESTIAIRES H (rouge) ────────────────────────────────────────────
  {
    id: 'vestiaires_h',
    name: 'Vestiaires H',
    area: '14m²',
    category: 'vestiaire',
    x: 43.0, y: 77.6, width: 13.1, height: 22.4,
    points: [
      { id: '4.14.1',  label: '4.14.1', x: 45.5, y: 82.5, pointType: '4', description: 'Banc homme' },
      { id: '4.14.2',  label: '4.14.2', x: 51.5, y: 82.5, pointType: '4', description: 'Poignet vestiaire homme' },
      { id: '4.14.2b', label: '4.14.2', x: 48.5, y: 92,   pointType: '4', description: 'Poignet vestiaire homme (bis)' },
      { id: '4.14.3',  label: '4.14.3', x: 45.5, y: 92,   pointType: '4', description: 'Sols de vestiaire homme' },
      { id: '4.14.4',  label: '4.14.4', x: 51.5, y: 96,   pointType: '4', description: 'Distributeur désinfectant homme' },
    ]
  },

  // ── VESTIAIRES VISITEUR (rouge) ─────────────────────────────────────
  {
    id: 'vestiaires_visiteur',
    name: 'Vestiaires Visiteur',
    area: '12m²',
    category: 'vestiaire',
    x: 56.1, y: 77.6, width: 13.1, height: 22.4,
    points: [
      { id: '4.16.3',  label: '4.16.3', x: 58.5, y: 82.5, pointType: '4', description: 'Sols de vestiaire visiteur' },
      { id: '4.16.1',  label: '4.16.1', x: 65.0, y: 82.5, pointType: '4', description: 'Banc visiteur' },
      { id: '4.16.3b', label: '4.16.3', x: 61.5, y: 92,   pointType: '4', description: 'Sols vestiaire visiteur (bis)' },
      { id: '4.16.2',  label: '4.16.2', x: 65.0, y: 92,   pointType: '4', description: 'Poignet vestiaire visiteur' },
      { id: '4.16.4',  label: '4.16.4', x: 58.5, y: 96,   pointType: '4', description: 'Distributeur désinfectant visiteur' },
    ]
  },

  // ── VESTIAIRES F (rouge) ────────────────────────────────────────────
  {
    id: 'vestiaires_f',
    name: 'Vest. F',
    area: '15m²',
    category: 'vestiaire',
    x: 69.2, y: 77.6, width: 14.6, height: 22.4,
    points: [
      { id: '4.15.1', label: '4.15.1', x: 71.5, y: 82.5, pointType: '4', description: 'Banc femme' },
      { id: '4.15.2', label: '4.15.2', x: 78.0, y: 82.5, pointType: '4', description: 'Poignet vestiaire femme' },
      { id: '4.15.3', label: '4.15.3', x: 74.5, y: 92,   pointType: '4', description: 'Sols de vestiaire femme' },
      { id: '4.15.4', label: '4.15.4', x: 78.0, y: 92,   pointType: '4', description: 'Distributeur désinfectant femme' },
    ]
  },

  // ── LABO MICROBIOLOGIE (bleu) — pochette libre entre Toilettes F et le
  // bord du mur extérieur bas (83.8 → 88.8, déjà la limite du mur ligne
  // 110 de FactoryMap.jsx), jamais câblée jusqu'ici malgré l'existence
  // réelle de la salle "4.17 Laboratoire Microbiologie" au catalogue officiel ──
  {
    id: 'labo_microbiologie',
    name: 'Labo Microbiologie',
    area: '5m²',
    category: 'white',
    x: 83.8, y: 77.6, width: 5.0, height: 22.4,
    points: [
      { id: '4.17.1', label: '4.17.1', x: 85.0, y: 84, pointType: '4', description: 'Paillasse labo microbiologie' },
      { id: '4.17.2', label: '4.17.2', x: 87.5, y: 84, pointType: '4', description: 'Equipement labo microbiologie' },
      { id: '4.17.3', label: '4.17.3', x: 86.3, y: 93, pointType: '4', description: 'Sol labo microbiologie' },
    ]
  },
];

export const ALL_POINT_IDS = ZONES.flatMap(z => z.points.map(p => p.id));

export function extractPointId(raw) {
  const m = raw.trim().match(/^(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : '';
}

// Points "aléatoires" créés en administration : identifiant à 2 segments
// {pointType}.{seq} (ex. "2.7"), à la différence des points officiels qui
// en ont 3 (ex. "4.12.1").
export function isRandomPointId(id) {
  return /^\d+\.\d+$/.test(String(id).trim());
}
