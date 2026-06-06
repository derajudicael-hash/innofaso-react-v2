# InnoFaso

Plateforme de suivi qualité eau — Backend (Express) + Frontend (React/Vite) + Map (Next.js)

## Prérequis

- [Node.js](https://nodejs.org/) v18+
- [MySQL](https://www.mysql.com/) ou [XAMPP](https://www.apachefriends.org/) (phpMyAdmin)

## Installation

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd innofaso-react-v2
```

### 2. Configurer les variables d'environnement

```bash
cp innofaso-backend/backend/.env.example innofaso-backend/backend/.env
```

Ouvrir `.env` et renseigner ton mot de passe MySQL si nécessaire (par défaut : root sans mot de passe).

### 3. Installer les dépendances et créer la base de données

> Vérifier que **MySQL / XAMPP est démarré** avant de lancer cette commande.

```bash
npm install
npm run setup
```

Cette commande installe les dépendances des 3 projets **et** crée automatiquement la base de données `innofaso` avec toutes ses tables.

## Lancement

```bash
npm run dev
```

Cela démarre les 3 services en même temps :

| Service  | URL                    |
|----------|------------------------|
| API      | http://localhost:4000  |
| Frontend | http://localhost:5173  |
| Map      | http://localhost:3000  |
