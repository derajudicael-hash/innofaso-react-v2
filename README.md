# InnoFaso

Plateforme de surveillance microbiologique pour unité de production agroalimentaire.

Architecture : **Backend Express.js** + **Frontend React/Vite** + **Carte Next.js**

Normes appliquées : NF EN ISO 18593 / EC 2073/2005 (seuils UFC/cm² par type de surface)

## Prérequis

- [Node.js](https://nodejs.org/) v18+
- [XAMPP](https://www.apachefriends.org/) (ou tout serveur MySQL)

## Installation en 4 étapes

> Démarrer **XAMPP → MySQL** avant de continuer.

### 1. Cloner le projet

```bash
git clone https://github.com/derajudicael-hash/innofaso-react-v2.git
cd innofaso-react-v2
```

### 2. Installer toutes les dépendances

```bash
npm install
```

Installe automatiquement les dépendances des 3 sous-projets (backend, frontend, map).

### 3. Créer la base de données

```bash
npm run setup
```

Crée la base `innofaso`, toutes les tables, les 13 zones, les 49 points de prélèvement avec leurs valeurs UFC de démonstration, et les historiques.

> **Config XAMPP standard (root sans mot de passe) → aucun fichier à modifier.**
>
> Si ton MySQL a un mot de passe :
> ```bash
> cp innofaso-backend/backend/.env.example innofaso-backend/backend/.env
> # Windows : copy innofaso-backend\backend\.env.example innofaso-backend\backend\.env
> ```
> Puis ouvrir le `.env` et renseigner `DB_PASSWORD=ton_mot_de_passe`.

### 4. Lancer le projet

```bash
npm run dev
```

Les 3 services démarrent dans le même terminal :

| Service  | URL                   | Description               |
|----------|-----------------------|---------------------------|
| API      | http://localhost:4000 | Backend Express.js        |
| Frontend | http://localhost:5173 | Dashboard React principal |
| Map      | http://localhost:3000 | Carte interactive d'usine |

Ouvrir **http://localhost:5173** dans le navigateur.

## Connexion

| Utilisateur | Mot de passe | Rôle           |
|-------------|--------------|----------------|
| `admin`     | `Admin2026!` | Administrateur |
| `qualite`   | `Qualite123!`| Éditeur        |

## Structure du projet

```
innofaso-react-v2/
├── innofaso-backend/backend/   # API Express.js (port 4000)
├── innofaso-frontend/          # Dashboard React/Vite (port 5173)
├── map/                        # Carte Next.js (port 3000)
└── package.json                # Lancement unifié (npm run dev)
```
