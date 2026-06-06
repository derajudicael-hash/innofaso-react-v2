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

### 2. Installer toutes les dépendances

```bash
npm install
npm run install:all
```

### 3. Configurer la base de données

1. Ouvrir **phpMyAdmin** (ou MySQL)
2. Créer une base de données nommée `innofaso`
3. Importer le fichier `innofaso-backend/backend/database.sql`

### 4. Configurer les variables d'environnement

```bash
cp innofaso-backend/backend/.env.example innofaso-backend/backend/.env
```

Ouvrir `.env` et renseigner ton mot de passe MySQL si nécessaire.

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
