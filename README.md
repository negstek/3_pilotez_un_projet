# DataShare

Prototype de partage de fichiers (upload, téléchargement par lien, historique, protection par mot de passe, expiration automatique). Voir [docs/architecture.md](docs/architecture.md) pour l'architecture détaillée et [docs/mcd.md](docs/mcd.md) pour le modèle de données.

## Stack

- **Back-end** : NestJS (TypeScript) — dossier [back/](back)
- **Front-end** : React + Vite (TypeScript) — dossier [front/](front)
- **Package partagé** : `@datashare/shared-lib` (types de l'API, règles de validation) — dossier [shared_lib/](shared_lib), utilisé par le back et le front
- **Base de données** : PostgreSQL, fournie en conteneur Docker via `docker-compose.yml`

Le dépôt est un monorepo **npm workspaces** (`package.json` à la racine) : les dépendances des trois packages sont installées en une fois, avec un seul `package-lock.json` à la racine. Les raisons de ce choix sont dans la note « package partagé front/back » de [docs/architecture.md](docs/architecture.md).

## Prérequis

- Node.js 20.19+ (ou 22.12+, exigé par Vite 8 et Prisma 7) et npm
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

3. Installer les dépendances, **depuis la racine du dépôt** (jamais dans `back/` ou `front/`) :

   ```bash
   npm install
   ```

   Cette commande installe le back, le front et `shared_lib`, compile `shared_lib` (dans `shared_lib/dist`) et génère le client Prisma du back. Les scripts d'installation de `bcrypt` (module natif) et de `prisma` sont autorisés dans le champ `allowScripts` du `package.json` racine, épinglés sur les versions vérifiées : après une mise à jour de l'un de ces paquets, npm demande de les approuver à nouveau (`npm install-scripts approve <paquet>`). Pour ajouter une dépendance à une application, préciser l'espace de travail : `npm install <paquet> -w back` (ou `-w front`).

4. Créer les tables en appliquant les migrations Prisma :

   ```bash
   cd back && npx prisma migrate deploy
   ```

   Après une modification de `back/prisma/schema.prisma`, générer une nouvelle migration avec `npm run prisma:migrate -- --name <nom>`.

## Lancer le projet en développement

```bash
# Terminal 1 — API
cd back && npm run start:dev

# Terminal 2 — front
cd front && npm run dev
```

- Front : http://localhost:8080
- API : http://localhost:3000

Le back et le front utilisent la version **compilée** de `shared_lib`. Hors VS Code, la garder compilée en continu dans un troisième terminal avec `npm run dev -w @datashare/shared-lib` : l'API et le front prennent alors en compte chaque modification sans redémarrage manuel. Avec les configurations de debug VS Code, c'est automatique (voir « Débogage dans VS Code »).

## Tests et lint

```bash
# back : tests unitaires, tests e2e (Supertest + base PostgreSQL de test), lint
cd back && npm test && npm run test:e2e && npm run lint

# front : tests unitaires et de composants (Vitest + React Testing Library), lint
cd front && npm test && npm run lint

# ou tout d'un coup, depuis la racine : tests unitaires et lint des trois packages
npm test && npm run lint
```

Le formatage est assuré par Prettier, avec une configuration propre à chaque package (`back/.prettierrc`, `front/.prettierrc`, `shared_lib/.prettierrc`) : `npm run format` reformate le code (depuis la racine, les trois packages), et côté front `npm run format:check` vérifie sans modifier.

Les tests e2e du back utilisent une base dédiée, `datashare_test`, sur le PostgreSQL du `docker-compose.yml` (configuration dans `back/.env.test`). Elle est créée et migrée automatiquement au lancement de `npm run test:e2e`, puis vidée avant chaque test : les données de développement ne sont jamais touchées. Le plan de tests est décrit dans [TESTING.md](TESTING.md).

### Analyse SonarQube

Un serveur SonarQube Community local tourne dans le conteneur `sonarqube-datashare` (http://localhost:9000, données conservées dans les volumes `sonarqube_datashare_*`). La configuration de l'analyse est dans [sonar-project.properties](sonar-project.properties). Depuis la racine, avec un jeton d'analyse (*My Account → Security*) dans `SONAR_TOKEN` :

```bash
docker start sonarqube-datashare   # si le conteneur est arrêté
docker run --rm --network host -e SONAR_HOST_URL=http://localhost:9000 -e SONAR_TOKEN -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli
```

Les résultats sont consultables sur http://localhost:9000/dashboard?id=datashare.

## Débogage dans VS Code

Le dépôt fournit une configuration de debug prête à l'emploi (`.vscode/launch.json`), accessible depuis l'onglet "Run and Debug" :

- **Debug back (NestJS)** : démarre PostgreSQL et la compilation continue de `shared_lib`, puis lance l'API en mode debug (`start:debug`), avec attachement automatique du débogueur Node.
- **Debug front (Chrome)** : démarre la compilation continue de `shared_lib` et le serveur de dev Vite, puis ouvre une session de debug Chrome sur `http://localhost:8080`.
- **Debug back + front** : lance les deux configurations précédentes en une fois.

Placer les points d'arrêt directement dans le code TypeScript (`back/src` ou `front/src`) avant de lancer la configuration.

La compilation continue de `shared_lib` tourne dans la tâche VS Code « shared-lib: watch » : une modification dans `shared_lib/src` est recompilée aussitôt, l'API redémarre et le front se recharge, sans relancer le debug. Les configurations de debug des tests compilent `shared_lib` une fois avant de lancer les tests.

Pour les tests, le fichier de test lui-même (et non le fichier testé) doit être l'onglet actif de l'éditeur. Placer les points d'arrêt, dans le test ou dans le code qu'il appelle, puis lancer :

- **Debug tests back : fichier courant** : un test unitaire du back (`*.spec.ts`).
- **Debug tests e2e back : fichier courant** : un test e2e du back (`test/*.e2e-spec.ts`) ; PostgreSQL est démarré automatiquement au préalable.
- **Debug tests front : fichier courant** : un test du front (`*.test.ts(x)`).

L'extension recommandée **Vitest** (`vitest.explorer`, proposée à l'ouverture du dépôt) permet en plus de lancer ou déboguer un test précis depuis l'icône dans la marge de l'éditeur ou depuis l'onglet « Testing ».

## Base de données

PostgreSQL tourne dans un conteneur Docker (`docker compose up -d`) afin que toute l'équipe partage la même version et la même configuration de base, sans installation locale. Voir la section « Environnement de développement » de [docs/architecture.md](docs/architecture.md) pour le détail.

Pour réinitialiser complètement la base (supprime les données) :

```bash
docker compose down -v && docker compose up -d
```
