# InnoFaso

Plateforme de suivi qualité eau — Backend (Express) + Frontend (React/Vite) + Map (Next.js)

## Prérequis

- [Node.js](https://nodejs.org/) v18+
- [XAMPP](https://www.apachefriends.org/) (ou tout autre serveur MySQL)

## Installation et lancement

### Étape 1 — Cloner ou télécharger le projet

```bash
git clone https://github.com/derajudicael-hash/innofaso-react-v2.git
cd innofaso-react-v2
```

> Si tu as téléchargé le ZIP depuis GitHub, extrais-le et entre dans le dossier `innofaso-react-v2-main` à l'intérieur.

### Étape 2 — Installer les dépendances et créer la base de données

> Vérifier que **XAMPP (MySQL) est démarré** avant de lancer cette commande.

```bash
npm install
npm run setup
```

Cette commande :
- installe les dépendances des 3 projets
- crée automatiquement le fichier `.env`
- crée la base de données `innofaso` avec toutes ses tables

> Par défaut la config MySQL est `root` sans mot de passe (paramètres XAMPP standard).
> Si ta config est différente, ouvre `innofaso-backend/backend/.env` et modifie `DB_PASSWORD`.

### Étape 3 — Lancer le projet

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
