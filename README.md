# InnoFaso

Plateforme de suivi qualité eau — Backend (Express) + Frontend (React/Vite) + Map (Next.js)

## Prérequis

- [Node.js](https://nodejs.org/) v18+
- [XAMPP](https://www.apachefriends.org/) (ou tout autre serveur MySQL)

## Installation et lancement

> Vérifier que **XAMPP (MySQL) est démarré** avant de commencer.

### 1. Cloner ou télécharger le projet

```bash
git clone https://github.com/derajudicael-hash/innofaso-react-v2.git
cd innofaso-react-v2
```

> Si tu as téléchargé le ZIP depuis GitHub : extraire, puis entrer dans le dossier `innofaso-react-v2-main` à l'intérieur.

### 2. Installer les dépendances

```bash
npm install
```

Installe automatiquement les dépendances des 3 projets (backend, frontend, map).

### 3. Créer la base de données

```bash
npm run setup
```

Crée automatiquement la base de données `innofaso` et toutes ses tables.

> Configuration par défaut : MySQL `root` sans mot de passe (XAMPP standard).
> Si ta config est différente, ouvre `innofaso-backend/backend/.env` et modifie `DB_PASSWORD`.

### 4. Lancer le projet

```bash
npm run dev
```

Les 3 services démarrent dans le même terminal :

| Service  | URL                     |
|----------|-------------------------|
| API      | http://localhost:4000   |
| Frontend | http://localhost:5173   |
| Map      | http://localhost:3000   |

Ouvrir **http://localhost:5173** dans le navigateur.
