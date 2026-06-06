export type ZoneCategory = 'white' | 'grey' | 'vestiaire' | 'laverie' | 'external';

export interface SamplingPoint {
  id: string;
  label: string;
  x: number; // % of SVG viewBox width (1515)
  y: number; // % of SVG viewBox height (490)
  pointType: '1' | '2' | '3' | '4';
  description: string;
}

export interface Zone {
  id: string;
  name: string;
  area?: string;
  category: ZoneCategory;
  x: number; y: number; width: number; height: number; // all %
  points: SamplingPoint[];
}

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

export const ZONES: Zone[] = [

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
      // Right column: 1.5.3, 1.5.6, 1.5.7, 1.5.8
      { id: '1.5.3r', label: '1.5.3', x: 36.5, y: 17.5, pointType: '1', description: 'Surface interne trémie conditionnement 4 (R)' },
      { id: '1.5.6r', label: '1.5.6', x: 36.5, y: 24.5, pointType: '1', description: 'Col formateur L4A (R)' },
      { id: '1.5.7', label: '1.5.7', x: 36.5, y: 31.5, pointType: '1', description: 'Col formateur conditionneuse L4B' },
      { id: '1.5.8', label: '1.5.8', x: 36.5, y: 38.5, pointType: '1', description: 'Canne dosage ensacheuses 1' },
      { id: '2.5.1', label: '2.5.1', x: 30.5, y: 57,   pointType: '2', description: 'Scotcheuse automatique' },
      { id: '3.5.1', label: '3.5.1', x: 30.5, y: 70,   pointType: '3', description: 'Tapis convoyeur conditionnement' },
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
      { id: '2.2.1', label: '2.2.1', x: 45.5, y: 33,   pointType: '2', description: 'Extérieur du mélangeur poudre' },
      { id: '3.2.2', label: '3.2.2', x: 52.0, y: 40,   pointType: '3', description: 'Mur zone de mélange poudre' },
      { id: '3.2.1', label: '3.2.1', x: 46.5, y: 56,   pointType: '3', description: 'Sol zone de mélange poudre' },
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
      { id: '2.3.1a', label: '2.3.1',  x: 74.5, y: 30,   pointType: '2', description: 'Plateau balance pesée pré mélange' },
      { id: '2.3.1b', label: '2.3.1',  x: 81.0, y: 30,   pointType: '2', description: 'Plateau balance pesée pré mélange (bis)' },
      { id: '3.3.1',  label: '3.3.1',  x: 81.0, y: 42,   pointType: '3', description: 'Palette plastique pesée prémélange' },
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
      { id: '4.14.2a', label: '4.14.2', x: 51.5, y: 82.5, pointType: '4', description: 'Poignet vestiaire homme' },
      { id: '4.14.2b', label: '4.14.2', x: 48.5, y: 92,   pointType: '4', description: 'Poignet vestiaire homme (bis)' },
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
      { id: '4.16.3a', label: '4.16.3', x: 58.5, y: 82.5, pointType: '4', description: 'Sols de vestiaire visiteur' },
      { id: '4.16.1',  label: '4.16.1', x: 65.0, y: 82.5, pointType: '4', description: 'Banc visiteur' },
      { id: '4.16.3b', label: '4.16.3', x: 61.5, y: 92,   pointType: '4', description: 'Sols vestiaire visiteur (bis)' },
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
    ]
  },
];

export const ALL_POINT_IDS: string[] = ZONES.flatMap(z => z.points.map(p => p.id));

export function extractPointId(raw: string): string {
  const m = raw.trim().match(/^(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : '';
}
