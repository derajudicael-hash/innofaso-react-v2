# InnoFaso

Plateforme de surveillance microbiologique pour unité de production agroalimentaire (Plumpy'Nut La Grâce).  
Suivi des niveaux UFC/cm² par zone, alertes en temps réel, cartographie interactive de l'usine.

**Stack :** React 18 + Vite (frontend) · Express.js + MySQL (backend)

---

## Prérequis

- [Node.js](https://nodejs.org/) v18+
- [XAMPP](https://www.apachefriends.org/) (ou tout autre serveur MySQL local)

---

## Installation

> Démarrer **XAMPP > MySQL** avant toute chose.

### 1. Cloner le dépôt

```bash
git clone https://github.com/derajudicael-hash/innofaso-react-v2.git
cd innofaso-react-v2
```

> Téléchargé en ZIP depuis GitHub ? Extraire, puis entrer dans le dossier `innofaso-react-v2-main`.

### 2. Installer les dépendances

```bash
npm install
```

Installe automatiquement backend et frontend en une seule commande.

### 3. Configurer la base de données

Ouvrir `innofaso-backend/backend/.env` et vérifier les valeurs :

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=        # laisser vide si XAMPP standard, sinon ton mot de passe
DB_NAME=innofaso
PORT=4000
```

Créer les tables :

```bash
npm run setup
```

### 4. Lancer le projet

```bash
npm run dev
```

Les deux services démarrent dans le même terminal :

| Service  | URL                   |
|----------|-----------------------|
| Backend  | http://localhost:4000 |
| Frontend | http://localhost:5173 |

Ouvrir **http://localhost:5173** dans le navigateur.

---

## Fonctionnalités

- **Tableau de bord** — 4 KPI (alertes critiques, surveillance, conformes, moyenne UFC), carte interactive de l'usine, graphique historique par zone
- **Alertes actives** — liste des zones en dépassement ou sous surveillance renforcée
- **Historique** — évolution des niveaux microbiologiques avec tendances
- **Cartographie** — plan de l'usine avec points de prélèvement et niveaux en couleur
- **Bulletins d'analyse** — import ZIP, affichage des résultats sur la carte
- **Paramètres** — configuration des seuils critiques et d'alerte
- **Administration** — gestion des zones, utilisateurs et données (accès protégé par mot de passe)
- **3 thèmes visuels** — switcher Blanc / TBTrack / Industriel dans la barre supérieure, mémorisé entre sessions

---

## Accès administration

Cliquer sur **Administration** dans le menu latéral pour ouvrir la page de connexion.  
Les identifiants sont configurés dans la base de données via `npm run setup`.

---

## Structure du projet

```
innofaso-react-v2/
├── innofaso-backend/
│   └── backend/          # Express.js · API REST · MySQL
│       ├── .env          # Variables d'environnement (à configurer)
│       └── setup-db.js   # Script de création de la base
├── innofaso-frontend/    # React 18 + Vite + TypeScript
│   └── src/
│       ├── components/   # Topbar, Sidebar, KpiCard, ChartSection...
│       ├── context/      # AuthContext, AdminDataContext, ThemeContext
│       ├── map/          # Cartographie interactive (FactoryMap, Sidebar...)
│       └── pages/        # Dashboard, History, Alerts, Settings, Admin
├── dashboard-themes.html # Prototype standalone des 3 thèmes (référence visuelle)
└── package.json          # Scripts racine (install, setup, dev)
```
