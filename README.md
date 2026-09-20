# DataShare

Prototype de partage de fichiers (upload, téléchargement par lien, historique, protection par mot de passe, expiration automatique). Voir [docs/architecture.md](docs/architecture.md) pour l'architecture détaillée et [docs/mcd.md](docs/mcd.md) pour le modèle de données.

## Stack

- **Back-end** : NestJS (TypeScript) — dossier [back/](back)
- **Front-end** : React + Vite (TypeScript) — dossier [front/](front)
- **Base de données** : PostgreSQL, fournie en conteneur Docker via `docker-compose.yml`

## Prérequis

- Node.js 20+ et npm
- Docker et Docker Compose

## Installation

1. Copier les fichiers d'environnement d'exemple :

   ```bash
   cp .env.example .env
   cp back/.env.example back/.env
   cp front/.env.example front/.env
   ```

2. Démarrer PostgreSQL :

   ```bash
   docker compose up -d
   ```

3. Installer les dépendances de chaque application :

   ```bash
   cd back && npm install
   cd ../front && npm install
   ```

## Lancer le projet en développement

```bash
# Terminal 1 — API
cd back && npm run start:dev

# Terminal 2 — front
cd front && npm run dev
```

- Front : http://localhost:5173
- API : http://localhost:3000

## Tests et lint

```bash
# back
cd back && npm test && npm run lint

# front
cd front && npm run lint
```

## Débogage dans VS Code

Le dépôt fournit une configuration de debug prête à l'emploi (`.vscode/launch.json`), accessible depuis l'onglet "Run and Debug" :

- **Debug back (NestJS)** : démarre PostgreSQL puis lance l'API en mode debug (`start:debug`), avec attachement automatique du débogueur Node.
- **Debug front (Chrome)** : démarre le serveur de dev Vite puis ouvre une session de debug Chrome sur `http://localhost:5173`.
- **Debug back + front** : lance les deux configurations précédentes en une fois.

Placer les points d'arrêt directement dans le code TypeScript (`back/src` ou `front/src`) avant de lancer la configuration.

## Base de données

PostgreSQL tourne dans un conteneur Docker (`docker compose up -d`) afin que toute l'équipe partage la même version et la même configuration de base, sans installation locale. Voir la section « Environnement de développement » de [docs/architecture.md](docs/architecture.md) pour le détail.

Pour réinitialiser complètement la base (supprime les données) :

```bash
docker compose down -v && docker compose up -d
```
