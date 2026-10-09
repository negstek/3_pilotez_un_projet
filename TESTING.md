# Plan de tests

Document vivant, complété à chaque fonctionnalité livrée. Les choix d'outils sont justifiés dans [docs/architecture.md](docs/architecture.md) (tableau de synthèse et note « simulation des appels API dans les tests front »).

## Fonctionnalités critiques et critères d'acceptation

Une fonctionnalité est critique quand une défaillance compromet la sécurité des données ou bloque le parcours principal (déposer un fichier, partager le lien, le télécharger). Elles sont testées en priorité, à tous les niveaux pertinents.

Types de test : **U** = unitaire (Vitest, back et front), **C** = composant React (React Testing Library), **I** = intégration de l'API (Supertest sur l'application complète et une base PostgreSQL de test), **E2E** = end-to-end dans un navigateur (Cypress, front et back réels).

| Fonctionnalité critique | US | Types de test | Critères d'acceptation | État |
|---|---|---|---|---|
| Création de compte | US03 | U, C, I, E2E | Email valide et mot de passe d'au moins 8 caractères : `201`, l'utilisateur arrive connecté sur son espace. Email déjà utilisé : `409`. Saisie invalide : `422`, erreur sous le champ. Le mot de passe n'est stocké que sous forme de hash bcrypt. | Validé |
| Connexion et émission du JWT | US04 | U, C, I, E2E | Identifiants valides : `200`, JWT émis, espace personnel ouvert, session conservée après rechargement. Mot de passe faux ou compte inconnu : `401` avec le même message. | Validé |
| Protection des routes par JWT | US04 | U, C, I, E2E | Sans token, ou avec un token falsifié ou expiré : `401`. Un visiteur qui ouvre l'espace personnel est renvoyé vers la connexion. | Validé |
| Upload avec contrôles, avec ou sans compte | US01, US07, US10 | U, C, I, E2E | Fichier accepté : `201` et lien unique, expiration à 7 jours par défaut. Plus de 1 Go, extension interdite, mot de passe de moins de 6 caractères, durée hors de 1 à 7 jours : `422`. Sans compte : mêmes règles, fichier sans propriétaire. Token invalide : `401`, aucun fichier créé. | Validé |
| Téléchargement par lien | US02, US09 | U, C, I, E2E | Le fichier téléchargé est identique au fichier déposé, sous son nom d'origine, sans compte. Lien inconnu : `404`. Lien expiré : `410`. Fichier protégé : mot de passe absent `422`, faux `401`, correct `200`. | Validé |
| Historique et suppression limités au propriétaire | US05, US06 | U, C, I | Un utilisateur ne voit que ses fichiers. Suppression : `204`, fichier retiré de la base et du disque, lien en `404`. Fichier d'un autre utilisateur ou d'un visiteur : `403`. | Validé |
| Purge des fichiers expirés | US10 | Aucun | Les fichiers expirés sont supprimés chaque jour (base et disque). | Non implémentée (US optionnelle) ; un lien expiré est déjà refusé en `410` |

Critères communs : tous les tests passent avant chaque commit poussé sur `main`, et la couverture reste au-dessus de 70 % (seuil des spécifications), faute de quoi `npm run test:cov` échoue.

## Résultats

Relevés le 2026-10-08, sur le commit en cours.

| Suite | Commande | Résultat |
|---|---|---|
| Unitaires `shared_lib` | `npm test -w @datashare/shared-lib` | 10 tests réussis sur 10 |
| Unitaires back | `cd back && npm test` | 68 tests réussis sur 68 |
| Intégration de l'API | `cd back && npm run test:e2e` | 43 tests réussis sur 43 |
| Unitaires et composants front | `cd front && npm test` | 72 tests réussis sur 72 |
| End-to-end Cypress | `npm run e2e` (racine) | 3 scénarios réussis sur 3 |

### Rapport de couverture

| | Instructions | Branches | Fonctions | Lignes | Seuil |
|---|---|---|---|---|---|
| Back (`cd back && npm run test:cov`) | 100 % | 83,78 % | 100 % | 100 % | 70 % |
| Front (`cd front && npm run test:cov`) | 91,69 % | 90,69 % | 87,75 % | 93,66 % | 70 % |
| **Global** (`npm run test:cov` à la racine) | 94,2 % | 88,92 % | 91,89 % | 95,62 % | 70 % |

`npm run test:cov` affiche le détail par fichier et écrit le rapport HTML dans `coverage/index.html`. À la racine, la commande lance celle du back puis celle du front, fusionne leurs deux rapports (`scripts/coverage-global.mjs`) et écrit le rapport global dans `coverage/index.html` à la racine ; les rapports par package restent dans `back/coverage/` et `front/coverage/`. Elle échoue si l'une des quatre mesures passe sous 70 %, par package comme au global.

Périmètre de la mesure :

- Tous les fichiers source comptent, y compris ceux qu'aucun test ne charge. Sont exclus le client Prisma généré, les fichiers de test, les points d'entrée (`main.ts`, `main.tsx`) et les modules Nest, qui ne contiennent que du câblage.
- Côté back, la couverture additionne les tests unitaires et les tests d'intégration de l'API : les contrôleurs, les guards et la stratégie JWT ne sont exercés que par des requêtes HTTP. Avec les seuls tests unitaires, les fonctions seraient couvertes à 56 %. La commande a donc besoin du PostgreSQL de `docker-compose`.
- Les scénarios Cypress ne sont pas comptés dans la couverture.
- `shared_lib` n'est pas mesuré : le back et le front l'utilisent sous sa forme compilée, et il ne contient presque que des types et des constantes.

### Badge de couverture

Le badge en tête du [README](README.md) affiche la couverture **globale des lignes** mesurée sur `main`. Il est tenu à jour par le workflow GitHub Actions `.github/workflows/coverage.yml` :

1. À chaque push sur `main` (et sur chaque pull request, sans publication), le workflow démarre un PostgreSQL identique à celui de `docker-compose.yml`, installe les dépendances et lance `npm run test:cov`. Il échoue donc sous 70 %, comme la commande en local.
2. `scripts/coverage-global.mjs` écrit, en plus du rapport, `coverage/badge.json` : le pourcentage et la couleur du badge (rouge sous 70 %, jaune sous 80 %, vert sous 90 %, vert vif au-delà).
3. Sur `main`, ce fichier est poussé dans la branche `badges` du dépôt, qui ne contient que lui (`coverage.json`, un seul commit remplacé à chaque exécution). shields.io le lit pour dessiner le badge.

Le chiffre n'est publié que si le workflow réussit : après un échec, le badge garde la valeur du dernier succès, et l'échec se voit dans l'onglet Actions (le badge y mène). Un changement de couverture apparaît après quelques minutes, le temps des caches de GitHub et de shields.io.

## Tests en place

Tous les tests unitaires (back et front) se lancent d'un coup depuis la racine du dépôt avec `npm test`, après un `npm install` à la racine (monorepo npm workspaces). Les commandes ci-dessous lancent les tests d'une seule application.

Le package partagé `shared_lib` (`@datashare/shared-lib`) contient surtout des types et des constantes (limites de saisie, messages d'erreur) : ces valeurs sont vérifiées là où elles sont utilisées, par les tests des DTO du back et de la validation du front. Sa seule fonction, le contrôle des extensions interdites, est testée dans le package (`cd shared_lib && npm test`) :

- `src/files.test.ts` : extensions interdites refusées quelle que soit la casse, noms voisins acceptés (`notes.sh.txt`, fichier sans extension).

### Back (NestJS) — `cd back`

**Unitaires** (`npm test`, Vitest, dépendances simulées) :

- `src/auth/auth.service.spec.ts` : le mot de passe est stocké sous forme de hash bcrypt salé (jamais en clair, deux hash différents pour un même mot de passe) ; le JWT émis porte l'identifiant et l'email ; le hash n'est jamais renvoyé ; la connexion refuse un mauvais mot de passe, et un email inconnu reçoit le même message.
- `src/auth/dto/auth-dto.spec.ts` : contrôles de saisie de l'inscription et de la connexion (format de l'email, 8 caractères minimum et 72 octets maximum à l'inscription, accents comptés en octets, aucune longueur minimale à la connexion, champs requis, normalisation de l'email).
- `src/auth/optional-jwt-auth.guard.spec.ts` : authentification optionnelle de l'upload (US07). L'utilisateur d'un token valide est transmis ; une requête sans en-tête `Authorization` passe en anonyme ; un en-tête présent mais sans token valide (token expiré ou falsifié, autre schéma, en-tête vide) est refusé en `401` au lieu d'être traité comme anonyme ; une erreur de la stratégie est relancée.
- `src/users/users.service.spec.ts` : la violation de la contrainte d'unicité sur l'email est traduite en `409`.
- `src/files/files.service.spec.ts` : l'upload stocke le contenu puis renvoie un lien vers le front avec un jeton UUID ; un upload anonyme est enregistré sans propriétaire, avec le même lien (US07) ; la date d'expiration suit la durée choisie ; le mot de passe est stocké haché ; le contenu est supprimé si l'enregistrement en base échoue ; les métadonnées n'exposent ni la clé de stockage ni le hash ; lien inconnu (`404`) ou expiré (`410`) ; mot de passe absent (`422`), faux (`401`) ou correct, le contenu n'étant ouvert qu'après vérification ; l'historique filtre sur le propriétaire et l'état du lien (actifs par défaut), du plus récent au plus ancien, sans exposer la clé de stockage ni le hash ; la suppression efface les métadonnées puis le contenu, refuse en `403` le fichier d'un autre utilisateur ou un upload anonyme, et répond `404` pour un fichier inconnu ou supprimé entre-temps.
- `src/files/dto/upload-file.dto.spec.ts` : contrôles de saisie de l'upload (7 jours par défaut, durée de 1 à 7 jours convertie depuis le texte du formulaire, mot de passe de 6 caractères minimum et 72 octets maximum, champ vide traité comme absent).
- `src/files/dto/list-files-query.dto.spec.ts` : filtre de l'historique (`active` par défaut, `active`, `expired` ou `all` acceptés, toute autre valeur refusée).
- `src/files/upload-errors.interceptor.spec.ts` : le `413` d'un fichier de plus de 1 Go devient un `422` avec le message du formulaire ; le fichier temporaire est supprimé en cas d'échec. Ce cas n'est pas testé en e2e, qui demanderait d'envoyer plus de 1 Go.
- `src/storage/local-storage.service.spec.ts` : enregistrement sous une clé aléatoire, relecture, suppression (y compris d'un fichier déjà supprimé), sur un vrai dossier temporaire.

**End-to-end API** (`npm run test:e2e`, Supertest + base PostgreSQL `datashare_test`) :

- `test/auth.e2e-spec.ts` : tous les codes de retour du contrat d'API pour `POST /auth/register` (201, 409 y compris avec une casse différente, 422), `POST /auth/login` (200, 401 mot de passe faux, 401 compte inconnu, 422) et `GET /auth/me` (200 avec token, 401 sans token ou avec un token falsifié).
- `test/files.e2e-spec.ts` (stockage dédié `STORAGE_DIR=storage-test`, vidé avant chaque test) : `POST /files` (201 avec fichier en base et sur le disque, 7 jours par défaut, durée choisie, mot de passe haché, nom accentué conservé ; 201 sans token pour un visiteur, fichier sans propriétaire mais mêmes règles et lien téléchargeable (US07) ; 401 pour un token falsifié ou illisible, sans fichier créé ; 422 sans fichier, extension interdite, mot de passe trop court, durée de 0, 8 ou « abc » jours ; aucun fichier temporaire laissé après un refus, y compris pour un visiteur), `GET /f/{jeton}` (200, 404, 410) et `POST /f/{jeton}/download` (contenu identique en pièce jointe et en `application/octet-stream`, nom encodé en UTF-8 ; 422, 401 puis 200 pour un fichier protégé ; 404 et 410), `GET /files` (200 avec les fichiers actifs par défaut, du plus récent au plus ancien, filtres `expired` et `all`, jamais les fichiers d'un autre utilisateur ni ceux d'un visiteur ; 401 ; 422 pour un filtre inconnu) et `DELETE /files/{id}` (204 avec suppression en base et sur le disque, puis lien en 404, y compris pour un fichier expiré ; 403 pour le fichier d'un autre utilisateur ou d'un visiteur, qui reste téléchargeable ; 404 pour un fichier déjà supprimé ou un identifiant qui n'est pas un UUID ; 401).

### Front (React) — `cd front`

**Unitaires et composants** (`npm test`, Vitest + React Testing Library ; module `src/api/` simulé avec `vi.mock`, sauf pour l'écran de téléchargement, testé avec MSW) :

- `src/auth/validation.test.ts` : règles de saisie côté client (email requis et au bon format, 8 caractères minimum et 72 octets maximum à l'inscription, mot de passe simplement requis à la connexion, confirmation).
- `src/auth/session.test.ts` : restauration de la session, rejet d'un token expiré ou illisible, déconnexion.
- `src/auth/RequireAuth.test.tsx` : redirection d'un visiteur non connecté (ou au token expiré) vers la connexion.
- `src/pages/LoginPage.test.tsx` et `src/pages/RegisterPage.test.tsx` : erreurs affichées sous les champs sans appel à l'API, appel à l'API puis redirection vers l'espace personnel, affichage du message d'erreur renvoyé par l'API (401, 409).
- `src/api/client.test.ts` : en-tête `Authorization: Bearer`, conversion des réponses en erreur, serveur injoignable.
- `src/components/ui/Button.test.tsx` : un bouton désactivé ne déclenche pas d'action.
- `src/components/ui/FileInfo.test.tsx` : nom complet conservé en info-bulle (le nom long est tronqué), détail affiché en erreur pour un fichier invalide, action affichée à côté du fichier.
- `src/files/files.test.ts` : affichage des tailles (« 2,6 Mo »), des durées et des dates, échéance d'une ligne de l'historique (« Expire demain », « Expiré le … »), calcul de l'expiration en jours calendaires (avertissement le jour même et la veille), contrôles de l'upload (1 Go, extensions interdites, mot de passe optionnel de 6 caractères minimum et 72 octets maximum).
- `src/pages/HomePage.test.tsx` : un visiteur téléverse sans compte, avec les mêmes options et sans token, sans être envoyé vers la connexion (US07) ; un `401` invite l'utilisateur à se reconnecter sans le déconnecter, pour que sa nouvelle tentative ne parte pas en anonyme ; upload avec le mot de passe et la durée choisis (7 jours par défaut) puis affichage du lien ; fichier interdit signalé dès sa sélection ; mot de passe trop court refusé sans appel à l'API ; message de l'API affiché en cas de refus.
- `src/pages/DownloadPage.test.tsx` (**MSW** : les requêtes sont interceptées au niveau réseau, le vrai client HTTP est donc exécuté contre les réponses du contrat d'API, cf. note « simulation des appels API dans les tests front » de l'architecture) : `GET /f/{jeton}` en `200` (métadonnées, échéance), `404` et `410` (message explicite, pas de bouton) ; `POST /f/{jeton}/download` en `200` (fichier remis au navigateur sous son nom d'origine, contenu identique), `401` puis `200` pour un fichier protégé (bouton désactivé tant que le mot de passe est vide, erreur sous le champ), `422` inattendu affiché dans un bandeau, et `410` d'un lien expiré après l'ouverture de la page. Toute requête hors du contrat fait échouer le test.
- `src/pages/my-files/MyFilesPage.test.tsx` : fichiers actifs affichés par défaut avec taille, dates, cadenas et lien « Accéder » ; rechargement avec le filtre choisi, fichier expiré sans action ; liste vide ; suppression seulement après confirmation, puis retrait de la liste ; message de l'API en cas d'échec (fichier déjà supprimé retiré de la liste) ; retour à la connexion quand la session a expiré côté serveur ; déconnexion.
- `src/api/client.test.ts` couvre aussi l'envoi d'un formulaire multipart, la réception d'un fichier binaire et la réponse `204` sans corps.

### End-to-end (Cypress) — `npm run e2e` à la racine

La commande démarre une pile dédiée, à côté de celle de développement : le back sur le port 3001 avec la base `datashare_test` et le stockage `storage-test`, le front sur `https://localhost:8081`. Elle lance ensuite les scénarios dans un navigateur sans interface, puis arrête les deux serveurs. `npm run e2e:open` ouvre l'interface de Cypress sur la même pile. Chaque scénario crée son propre compte, avec un email unique : ils ne dépendent ni les uns des autres ni du contenu de la base.

- `front/cypress/e2e/register.cy.ts` : inscription par le formulaire, puis arrivée sur l'espace personnel (US03).
- `front/cypress/e2e/login.cy.ts` : un visiteur qui ouvre l'espace personnel est renvoyé vers la connexion, se connecte, arrive sur son espace et y reste après un rechargement de la page (US04).
- `front/cypress/e2e/upload-download.cy.ts` : un utilisateur connecté téléverse un fichier et obtient son lien ; le lien est ouvert sans session, le fichier est téléchargé et son contenu est comparé à celui d'origine (US01, US02).

#### Cypress Studio

Cypress Studio enregistre les actions faites dans le navigateur (clics, saisies, sélections) et les convertit en commandes Cypress, écrites directement dans le fichier de test. Pour le démarrer, depuis la racine du dépôt :

```bash
npm run e2e:open
```

La commande démarre le back et le front de test, puis ouvre l'interface de Cypress : choisir « E2E Testing » et un navigateur, lancer un fichier de test, puis cliquer sur la baguette magique affichée au survol d'un test (« Add commands to test ») ou d'un `describe` (« Add new test »). « Save Commands » écrit les commandes dans le fichier `.cy.ts`.

Intérêts pour le développeur :

- **Écrire le premier jet d'un scénario plus vite** : le parcours est joué une fois à la main, sans chercher chaque sélecteur ni relancer le test à chaque étape.
- **Prolonger un test existant** à partir de l'état où il s'arrête (compte créé, fichier téléversé), sans rejouer le début à la main.
- **Trouver un sélecteur** pour un élément de l'interface.
- **Reproduire un bug sous forme de test**, en rejouant les actions qui le déclenchent.

Le code généré reste un brouillon, à relire avant de le garder : Studio choisit parfois des sélecteurs fragiles (classes CSS, position dans la page), n'ajoute que les assertions qu'on lui demande, et ignore les fonctions partagées de `cypress/support/` (compte à email unique).
