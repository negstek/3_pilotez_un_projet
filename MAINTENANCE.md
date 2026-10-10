# Maintenance

Ce document décrit les procédures de maintenance de DataShare : les contrôles automatiques, la mise à jour des dépendances (fréquence, risques, procédure), la correction d'une anomalie et les opérations courantes sur la base, les fichiers et les secrets. La sécurité est détaillée dans [SECURITY.md](SECURITY.md), les tests dans [TESTING.md](TESTING.md) et le suivi de performance dans [PERF.md](PERF.md).

## Contrôles automatiques

Les contrôles qualité s'exécutent à trois moments, du plus rapide au plus complet :

| Moment | Contrôles | Bloquant | Durée |
|---|---|---|---|
| **`git commit`** (hook `.githooks/pre-commit`) | lint oxlint avec analyse typée (dont API dépréciées), formatage Prettier | oui | ~4 s |
| **`git push`** (hook `.githooks/pre-push`) | `npm audit` des dépendances de production (gravité haute ou critique) ; `npm outdated` | audit : oui ; outdated : non (information) | ~5 s, réseau requis |
| **CI GitHub Actions**, à chaque push sur `main` et chaque pull request | `quality.yml` : lint, formatage, audit, rapport complet `npm audit` / `npm outdated`, Trivy ; `coverage.yml` : tests et couverture ≥ 70 % | oui (sauf rapports) | quelques minutes |
| **CI, chaque lundi** (`schedule`) | `quality.yml` complet | oui | — |

**Activation des hooks.** Ce sont des hooks Git natifs, versionnés dans `.githooks/`. Le script `prepare` du `package.json`, exécuté par `npm install`, les active (`git config core.hooksPath .githooks`). Il n'y a rien à faire après un clone, sinon `npm install`. Les raisons de ce choix plutôt que Husky sont dans la note « contrôles automatisés : hooks Git, CI et scanners de sécurité » de [docs/architecture.md](docs/architecture.md).

**Contournement.** `git commit --no-verify` ou `git push --no-verify` court-circuite les hooks : c'est utile sans réseau, ou pour un commit de travail intermédiaire sur une branche. La CI refait les mêmes contrôles : un contournement ne fait que repousser l'échec, il ne l'évite pas.

**Pourquoi `npm outdated` n'est pas bloquant.** Il signale tout paquet en retard, y compris d'une version majeure qu'on a choisi de ne pas adopter. Il serait donc presque toujours en échec. Les mises à jour suivent le rythme décrit ci-dessous, pas celui des push.

## Mise à jour des dépendances

### Fréquence

| Situation | Délai | Déclencheur |
|---|---|---|
| Vulnérabilité **haute ou critique** dans une dépendance de production | **immédiat** (avant tout autre développement) | hook `pre-push` ou CI en échec |
| Vulnérabilité basse ou modérée, ou dans une dépendance de développement | sous une semaine | rapport `npm audit` du résumé de la CI |
| Versions **correctives et mineures** (dans les plages du `package.json`) | **toutes les deux semaines**, ou au début de chaque lot de développement | `npm outdated`, colonne *Wanted* |
| Versions **majeures** | au cas par cas, **une par une**, après lecture du guide de migration | `npm outdated`, colonne *Latest* |
| Images Docker et outils épinglés (PostgreSQL, Trivy, k6, Node, actions GitHub) | tous les mois | voir « Outils épinglés » |

Pourquoi ce rythme : des mises à jour fréquentes et petites sont plus sûres qu'une grosse mise à jour en fin de projet. Quand un test casse, le coupable est vite trouvé. Une mise à jour en retard de plusieurs versions majeures, au contraire, cumule les ruptures. À l'inverse, adopter une version le jour de sa sortie expose aux régressions et aux paquets compromis : on laisse passer quelques jours pour les versions majeures et les outils de la CI.

### Risques

| Type de mise à jour | Risque | Parade |
|---|---|---|
| Corrective (x.y.**Z**) | Faible : régression ponctuelle | Suite de tests complète |
| Mineure (x.**Y**.z) | Faible à moyen : nouvelle fonctionnalité, parfois une dépréciation | Tests ; le lint (`typescript/no-deprecated`) signale les API dépréciées |
| Majeure (**X**.y.z) | Élevé : changements incompatibles | Lire le changelog et le guide de migration, une majeure par commit, tests e2e et Cypress |
| Paquet compromis (*supply chain*) | Élevé : code malveillant exécuté à l'installation | `npm ci` sur le lockfile, scripts d'installation autorisés un par un (`allowScripts`), versions épinglées pour les outils de la CI, délai avant adoption |
| `overrides` oublié | Moyen : version forcée qui diverge de celle attendue par le paquet parent | Revue des `overrides` à chaque mise à jour du parent (voir ci-dessous) |

Points d'attention propres au projet :

- **Prisma** : la CLI (`prisma`) et le client (`@prisma/client`, `@prisma/adapter-pg`) se mettent à jour **ensemble**, à la même version. Après la mise à jour : `npm install` (qui régénère le client), puis vérification des migrations sur la base de test (`npm run test:e2e -w back`).
- **NestJS** : tous les paquets `@nestjs/*` d'une même version majeure ensemble ; `nestjs-pino` doit accepter la nouvelle version dans ses `peerDependencies`.
- **Scripts d'installation** : `bcrypt` (module natif), `prisma` et `cypress` sont autorisés dans `allowScripts` du `package.json` racine, épinglés par version. Après leur mise à jour, npm demande une nouvelle approbation (`npm install-scripts approve <paquet>`) : vérifier que la nouvelle version vient bien de l'éditeur habituel avant d'approuver.
- **`@types/node`** suit la version de Node utilisée à l'exécution (24), et non la dernière publiée : des types plus récents décriraient des API absentes du runtime.
- **Outils communs aux trois packages** (Vitest, TypeScript, oxlint, Prettier) : la même version majeure partout, mises à jour ensemble.

### Procédure

1. Partir d'une branche à jour : `git switch -c chore/deps-AAAA-MM-JJ`.
2. Faire l'état des lieux, **depuis la racine** :
   ```bash
   npm outdated
   npm audit
   ```
3. Mettre à jour :
   - correctives et mineures, dans les plages existantes : `npm update` ;
   - une majeure, après lecture de son guide de migration : `npm install <paquet>@<version> -w <back|front|@datashare/shared-lib>`.
4. Relire le diff de `package-lock.json` pour repérer les nouveaux paquets transitifs inattendus.
5. Repasser **tous** les contrôles :
   ```bash
   npm run build && npm run lint && npm run format:check
   npm test && npm run test:e2e -w back
   npm run e2e            # scénarios Cypress
   npm run test:cov       # seuil de 70 %
   npm run security:audit && npm run security:trivy
   ```
   Pour une mise à jour qui touche au chemin des fichiers (multer, NestJS, Express, Node), relancer aussi `npm run perf` et comparer avec les résultats de [PERF.md](PERF.md).
6. Revoir les **`overrides`** du `package.json` racine : pour chacun, vérifier si le paquet parent embarque désormais lui-même une version corrigée (`npm ls <paquet>` après avoir retiré temporairement l'override). Si oui, retirer l'override. Sinon, le garder et mettre à jour sa justification dans [SECURITY.md](SECURITY.md).
7. Committer, avec une majeure par commit : `chore(deps): …` pour une mise à jour courante, `fix(deps): …` pour une correction de vulnérabilité, avec dans le corps du message ce qui a été vérifié.
8. Pousser et ouvrir une pull request : la CI rejoue l'ensemble.

### Outils épinglés

Certains outils ne passent pas par `package.json` et ne sont donc pas signalés par `npm outdated`. Ils sont épinglés sur une version précise, pour que la CI soit reproductible :

| Outil | Où | Vérifier les nouvelles versions |
|---|---|---|
| Image PostgreSQL `postgres:16-alpine` | `docker-compose.yml`, `.github/workflows/coverage.yml` | `docker pull postgres:16-alpine` (correctifs de la 16) ; changer de version majeure demande une migration des données (`pg_dump` / restauration) |
| Trivy `aquasec/trivy:0.74.0` | `scripts/trivy.sh` | [versions de Trivy](https://github.com/aquasecurity/trivy/releases) |
| k6 `grafana/k6:2.3.0` | `scripts/perf.sh` | [versions de k6](https://github.com/grafana/k6/releases) |
| Node 24 et npm 12 | workflows GitHub Actions | [calendrier de Node](https://nodejs.org/en/about/previous-releases) : rester sur une version LTS |
| Actions GitHub (`actions/checkout`, `actions/setup-node`) | workflows | onglet *Actions* du dépôt (avertissements de dépréciation) |

### État au 10/10/2026

Correctives et mineures appliquées (`@types/node` 24.19.2, `dotenv` 18.0.7, `vite` 8.3.4). Les dépendances inutilisées ont été retirées : `@nestjs/mau` (voir SECURITY.md), et `vite-tsconfig-paths`, que Vite remplace nativement (`resolve.tsconfigPaths`). Majeures volontairement différées :

| Paquet | Actuelle | Disponible | Décision |
|---|---|---|---|
| `typescript` | 6.0 | 7.0 | Différée : nouveau compilateur natif. Attendre que l'écosystème (NestJS CLI, Vite, oxlint) le prenne officiellement en charge |
| `prisma` / `@prisma/client` | 7.10 | 8.0.0-rc | Différée : version candidate, pas encore stable |
| `msw` | 2.15 | 3.0 | Différée : dépendance de test du front, sans impact sur la production ; à faire au prochain lot front |
| `@types/node` | 24 | 26 | Non applicable : les types suivent le runtime Node 24 |

## Corriger une anomalie

1. **Qualifier.** Reproduire le problème et noter l'heure, la route et le code HTTP. Si l'utilisateur dispose de l'en-tête `X-Request-Id` de la réponse (onglet Réseau du navigateur), cet identifiant donne toutes les lignes de log de la requête.
2. **Diagnostiquer avec les logs** (une ligne JSON par événement, voir [PERF.md](PERF.md)) :
   ```bash
   # toutes les lignes d'une requête
   jq 'select(.reqId == "<X-Request-Id>")' back.log
   # erreurs serveur et requêtes refusées récentes
   jq 'select(.level >= 40) | {time, msg, url: .req.url, status: .res.statusCode, err}' back.log
   ```
   Pour plus de détail, relancer le back avec `LOG_LEVEL=debug`.
3. **Écrire d'abord un test qui échoue** et reproduit l'anomalie, au niveau le plus bas possible (unitaire, puis Supertest, puis Cypress seulement pour un parcours dans le navigateur). Il protège ensuite contre la régression.
4. **Corriger** sur une branche `fix/<sujet>`, jusqu'à ce que le test passe, ainsi que tous les autres.
5. **Contrôler** : les hooks s'exécutent au commit et au push ; pour une correction sensible (authentification, fichiers), lancer aussi `npm run test:cov` et `npm run e2e`.
6. **Committer** en `fix: …`, avec dans le corps la cause, la correction et le test ajouté ; pousser, ouvrir une pull request et vérifier la CI.
7. **Documenter** : si la correction change un comportement, mettre à jour le contrat d'API (`docs/api-contract.yaml`) et la note concernée de [docs/architecture.md](docs/architecture.md).

**Correction de sécurité urgente** (vulnérabilité exploitable dans une dépendance) : même procédure, en priorité sur tout le reste. Si aucune version corrigée n'existe, évaluer le contournement (`overrides` vers une version corrigée de la dépendance transitive, désactivation de la fonctionnalité concernée) et consigner la décision dans [SECURITY.md](SECURITY.md).

## Opérations courantes

### Base de données

- **Évolution du schéma** : modifier `back/prisma/schema.prisma`, générer la migration (`npm run prisma:migrate -w back -- --name <nom>`), la relire et la committer avec le code. Au déploiement : `npx prisma migrate deploy`, qui n'applique que les migrations manquantes et ne supprime jamais de données.
- **Sauvegarde** : la base et le dossier des fichiers (`STORAGE_DIR`) vont ensemble. Une ligne de la table `files` sans son fichier donne un lien cassé, et un fichier sans sa ligne n'est jamais purgé.
  ```bash
  docker exec datashare-db pg_dump -U datashare -Fc datashare > backup-$(date +%F).dump
  tar czf storage-$(date +%F).tar.gz -C back storage
  ```
- **Restauration** : arrêter le back, puis restaurer la base et le dossier de la même date :
  ```bash
  docker exec -i datashare-db pg_restore -U datashare -d datashare --clean --if-exists < backup-AAAA-MM-JJ.dump
  tar xzf storage-AAAA-MM-JJ.tar.gz -C back
  ```

### Fichiers et espace disque

- La purge quotidienne d'US10 n'est pas réalisée : les liens expirés sont refusés (410), mais les fichiers expirés restent sur le disque et en base. L'écran « Mes fichiers » ne propose pas de supprimer un fichier expiré : son propriétaire ne peut le faire que par l'API (`DELETE /files/{id}`), et un fichier anonyme expiré ne peut être retiré que par une intervention manuelle. C'est la première évolution à prévoir si l'application est mise en service.
- Surveiller l'espace libre du volume de `STORAGE_DIR` : chaque upload peut atteindre 1 Go, et l'événement `file uploaded` des logs donne le volume déposé (`sizeBytes`).
- Le sous-dossier `tmp/` reçoit les uploads en cours. Un fichier qui y reste après un redémarrage du back provient d'un upload interrompu : il peut être supprimé.

### Secrets

- **`JWT_SECRET`** : valeur aléatoire longue (`openssl rand -hex 32`), propre à chaque environnement, jamais commitée. Le changer **déconnecte tous les utilisateurs** (leurs tokens deviennent invalides) : c'est la procédure à suivre en cas de fuite supposée.
- Mots de passe de la base : définis dans le `.env` racine (conteneur) et dans `DATABASE_URL` (back), qui doivent rester cohérents.
