// ─────────────────────────────────────────────────────────────────────────
// Pixel-accurate measurements from the 1515×490 factory floor image
// Reference columns (% of 1515):
//   outer-left=0, stockage-right=22.3, cond-right=43.0,
//   melange-right=56.1, premix-right=72.3, huile-right=83.8,
//   sas-right=88.6, mat-prem-left=88.6, outer-right=100
// Reference rows (% of 490):
//   top=0, floor-top=4.3, blue-zones-bottom=77.6,
//   vestiaire-bottom=100
//
// Géométrie des zones uniquement — c'est le bâtiment physique, elle ne change
// pas. Les points de prélèvement ne sont plus codés en dur ici : ils sont
// créés dynamiquement par l'import des bulletins (résolution Salle → Zone
// côté backend) ou manuellement depuis le panneau "Points à placer" en
// administration, et consommés via usePoints()/pointsByZone.
// ─────────────────────────────────────────────────────────────────────────

export const ZONES = [
  { id: 'stockage_pf', name: 'Stokage Produits Finis', area: '78m²', category: 'grey',
    x: 0, y: 4.3, width: 22.3, height: 73.3 },

  { id: 'conditionnement', name: 'Conditionnement', area: '80m²', category: 'white',
    x: 22.3, y: 10.2, width: 20.7, height: 67.4 },

  { id: 'melange', name: 'Mélange', area: '32m²', category: 'white',
    x: 43.0, y: 16.3, width: 13.1, height: 51.3 },

  { id: 'premix', name: 'PreMélange', area: '32m²', category: 'white',
    x: 56.1, y: 4.3, width: 16.2, height: 47.3 },

  { id: 'pesage', name: 'Pesage poudres', area: '14m²', category: 'white',
    x: 56.1, y: 51.6, width: 16.2, height: 26 },

  { id: 'huile', name: 'Huile et pesage S+A+H', area: '23m²', category: 'white',
    x: 72.3, y: 10.2, width: 11.5, height: 47.4 },

  { id: 'sas_poudres', name: 'SAS poudres', area: '7m²', category: 'white',
    x: 72.3, y: 57.6, width: 11.5, height: 20 },

  { id: 'matieres_premieres', name: 'Matières Première', area: '80m²', category: 'grey',
    x: 88.6, y: 4.3, width: 11.4, height: 73.3 },

  { id: 'laverie', name: 'Laverie + buanderie', area: '21m²', category: 'laverie',
    x: 22.3, y: 77.6, width: 20.7, height: 22.4 },

  { id: 'vestiaire_laverie', name: 'Vestiaire Laverie', category: 'external',
    x: 0, y: 77.6, width: 22.3, height: 22.4 },

  { id: 'vestiaires_h', name: 'Vestiaires H', area: '14m²', category: 'vestiaire',
    x: 43.0, y: 77.6, width: 13.1, height: 22.4 },

  { id: 'vestiaires_visiteur', name: 'Vestiaires Visiteur', area: '12m²', category: 'vestiaire',
    x: 56.1, y: 77.6, width: 13.1, height: 22.4 },

  { id: 'vestiaires_f', name: 'Vest. F', area: '15m²', category: 'vestiaire',
    x: 69.2, y: 77.6, width: 14.6, height: 22.4 },

  // Pochette libre entre Toilettes F et le bord du mur extérieur bas
  // (83.8 → 88.8, déjà la limite du mur ligne 110 de FactoryMap.jsx).
  { id: 'labo_microbiologie', name: 'Labo Microbiologie', area: '5m²', category: 'white',
    x: 83.8, y: 77.6, width: 5.0, height: 22.4 },
];

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
