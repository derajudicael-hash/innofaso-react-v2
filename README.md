# InnoFaso

Plateforme de suivi qualité eau — Backend (Express) + Frontend (React/Vite) + Map (Next.js)

## Prérequis

- [Node.js](https://nodejs.org/) v18+
- [MySQL](https://www.mysql.com/) ou [XAMPP](https://www.apachefriends.org/) (phpMyAdmin)

## Installation et lancement

### Étape 1 — Cloner le projet

```bash
git clone https://github.com/derajudicael-hash/innofaso-react-v2.git
cd innofaso-react-v2
```

### Étape 2 — Configurer la base de données

Copier le fichier de configuration :

```bash
cp innofaso-backend/backend/.env.example innofaso-backend/backend/.env
```

> Sur Windows :
> ```
> copy innofaso-backend\backend\.env.example innofaso-backend\backend\.env
> ```

Ouvrir `.env` et renseigner ton mot de passe MySQL si nécessaire (par défaut : root sans mot de passe).

### Étape 3 — Installer les dépendances et créer la base de données

> Vérifier que **MySQL / XAMPP est démarré** avant de lancer cette commande.

```bash
npm install
npm run setup
```

Cette commande installe les dépendances des 3 projets **et** crée automatiquement la base de données `innofaso` avec toutes ses tables.

### Étape 4 — Lancer le projet

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
