# Plan de tests

Document vivant, complété à chaque fonctionnalité livrée. Les choix d'outils sont justifiés dans [docs/architecture.md](docs/architecture.md) (tableau de synthèse et note « simulation des appels API dans les tests front »).

## Fonctionnalités critiques

Une fonctionnalité est critique quand une défaillance compromet la sécurité des données ou bloque le parcours principal (déposer un fichier, partager le lien, le télécharger). Elles sont testées en priorité, à tous les niveaux pertinents.

| Fonctionnalité | US | Pourquoi elle est critique | État |
|---|---|---|---|
| Création de compte | US03 | Unicité de l'email, mot de passe jamais stocké en clair | Testée |
| Connexion et émission du JWT | US04 | Porte d'entrée de toutes les routes protégées | Testée |
| Protection des routes par JWT | US04 | Empêche l'accès aux fichiers d'un autre utilisateur | Testée (`GET /auth/me`, routes des fichiers) |
| Upload avec contrôles (taille, extensions interdites, expiration, mot de passe) | US01, US07, US10 | Parcours principal ; refuse les fichiers dangereux | Testée pour US01 (upload anonyme US07 à venir) |
| Téléchargement par lien (lien inconnu, expiré, mot de passe) | US02, US09 | Parcours principal ; seul accès public aux fichiers | Testée |
| Historique et suppression limités au propriétaire | US05, US06 | Confidentialité des fichiers entre utilisateurs | Testée |
| Purge des fichiers expirés | US10 | Les fichiers ne doivent pas survivre à leur expiration | À venir |

## Tests en place

Tous les tests unitaires (back et front) se lancent d'un coup depuis la racine du dépôt avec `npm test`, après un `npm install` à la racine (monorepo npm workspaces). Les commandes ci-dessous lancent les tests d'une seule application.

Le package partagé `shared_lib` (`@datashare/shared-lib`) contient surtout des types et des constantes (limites de saisie, messages d'erreur) : ces valeurs sont vérifiées là où elles sont utilisées, par les tests des DTO du back et de la validation du front. Sa seule fonction, le contrôle des extensions interdites, est testée dans le package (`cd shared_lib && npm test`) :

- `src/files.test.ts` : extensions interdites refusées quelle que soit la casse, noms voisins acceptés (`notes.sh.txt`, fichier sans extension).

### Back (NestJS) — `cd back`

**Unitaires** (`npm test`, Vitest, dépendances simulées) :

- `src/auth/auth.service.spec.ts` : le mot de passe est stocké sous forme de hash bcrypt salé (jamais en clair, deux hash différents pour un même mot de passe) ; le JWT émis porte l'identifiant et l'email ; le hash n'est jamais renvoyé ; la connexion refuse un mauvais mot de passe, et un email inconnu reçoit le même message.
- `src/auth/dto/auth-dto.spec.ts` : contrôles de saisie de l'inscription et de la connexion (format de l'email, 8 caractères minimum et 72 octets maximum à l'inscription, accents comptés en octets, aucune longueur minimale à la connexion, champs requis, normalisation de l'email).
- `src/users/users.service.spec.ts` : la violation de la contrainte d'unicité sur l'email est traduite en `409`.
- `src/files/files.service.spec.ts` : l'upload stocke le contenu puis renvoie un lien vers le front avec un jeton UUID ; la date d'expiration suit la durée choisie ; le mot de passe est stocké haché ; le contenu est supprimé si l'enregistrement en base échoue ; les métadonnées n'exposent ni la clé de stockage ni le hash ; lien inconnu (`404`) ou expiré (`410`) ; mot de passe absent (`422`), faux (`401`) ou correct, le contenu n'étant ouvert qu'après vérification ; l'historique filtre sur le propriétaire et l'état du lien (actifs par défaut), du plus récent au plus ancien, sans exposer la clé de stockage ni le hash ; la suppression efface les métadonnées puis le contenu, refuse en `403` le fichier d'un autre utilisateur ou un upload anonyme, et répond `404` pour un fichier inconnu ou supprimé entre-temps.
- `src/files/dto/upload-file.dto.spec.ts` : contrôles de saisie de l'upload (7 jours par défaut, durée de 1 à 7 jours convertie depuis le texte du formulaire, mot de passe de 6 caractères minimum et 72 octets maximum, champ vide traité comme absent).
- `src/files/dto/list-files-query.dto.spec.ts` : filtre de l'historique (`active` par défaut, `active`, `expired` ou `all` acceptés, toute autre valeur refusée).
- `src/files/upload-errors.interceptor.spec.ts` : le `413` d'un fichier de plus de 1 Go devient un `422` avec le message du formulaire ; le fichier temporaire est supprimé en cas d'échec. Ce cas n'est pas testé en e2e, qui demanderait d'envoyer plus de 1 Go.
- `src/storage/local-storage.service.spec.ts` : enregistrement sous une clé aléatoire, relecture, suppression (y compris d'un fichier déjà supprimé), sur un vrai dossier temporaire.

**End-to-end API** (`npm run test:e2e`, Supertest + base PostgreSQL `datashare_test`) :

- `test/auth.e2e-spec.ts` : tous les codes de retour du contrat d'API pour `POST /auth/register` (201, 409 y compris avec une casse différente, 422), `POST /auth/login` (200, 401 mot de passe faux, 401 compte inconnu, 422) et `GET /auth/me` (200 avec token, 401 sans token ou avec un token falsifié).
- `test/files.e2e-spec.ts` (stockage dédié `STORAGE_DIR=storage-test`, vidé avant chaque test) : `POST /files` (201 avec fichier en base et sur le disque, 7 jours par défaut, durée choisie, mot de passe haché, nom accentué conservé ; 401 sans token ; 422 sans fichier, extension interdite, mot de passe trop court, durée de 0, 8 ou « abc » jours ; aucun fichier temporaire laissé après un refus), `GET /f/{jeton}` (200, 404, 410) et `POST /f/{jeton}/download` (contenu identique en pièce jointe et en `application/octet-stream`, nom encodé en UTF-8 ; 422, 401 puis 200 pour un fichier protégé ; 404 et 410), `GET /files` (200 avec les fichiers actifs par défaut, du plus récent au plus ancien, filtres `expired` et `all`, jamais les fichiers d'un autre utilisateur ; 401 ; 422 pour un filtre inconnu) et `DELETE /files/{id}` (204 avec suppression en base et sur le disque, puis lien en 404, y compris pour un fichier expiré ; 403 pour le fichier d'un autre utilisateur, qui reste téléchargeable ; 404 pour un fichier déjà supprimé ou un identifiant qui n'est pas un UUID ; 401).

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
- `src/pages/HomePage.test.tsx` : un visiteur est envoyé vers la connexion ; upload avec le mot de passe et la durée choisis (7 jours par défaut) puis affichage du lien ; fichier interdit signalé dès sa sélection ; mot de passe trop court refusé sans appel à l'API ; message de l'API affiché en cas de refus.
- `src/pages/DownloadPage.test.tsx` (**MSW** : les requêtes sont interceptées au niveau réseau, le vrai client HTTP est donc exécuté contre les réponses du contrat d'API, cf. note « simulation des appels API dans les tests front » de l'architecture) : `GET /f/{jeton}` en `200` (métadonnées, échéance), `404` et `410` (message explicite, pas de bouton) ; `POST /f/{jeton}/download` en `200` (fichier remis au navigateur sous son nom d'origine, contenu identique), `401` puis `200` pour un fichier protégé (bouton désactivé tant que le mot de passe est vide, erreur sous le champ), `422` inattendu affiché dans un bandeau, et `410` d'un lien expiré après l'ouverture de la page. Toute requête hors du contrat fait échouer le test.
- `src/pages/my-files/MyFilesPage.test.tsx` : fichiers actifs affichés par défaut avec taille, dates, cadenas et lien « Accéder » ; rechargement avec le filtre choisi, fichier expiré sans action ; liste vide ; suppression seulement après confirmation, puis retrait de la liste ; message de l'API en cas d'échec (fichier déjà supprimé retiré de la liste) ; retour à la connexion quand la session a expiré côté serveur ; déconnexion.
- `src/api/client.test.ts` couvre aussi l'envoi d'un formulaire multipart, la réception d'un fichier binaire et la réponse `204` sans corps.

## Critères d'acceptation

- Tous les tests passent avant chaque commit poussé sur `main`.
- Chaque fonctionnalité critique est couverte par au moins un test unitaire et un test e2e API sur ses cas nominaux et ses cas d'erreur du contrat d'API.
- Couverture visée : 70 % (objectif des spécifications), mesurée par `npm run test:cov` dans `back/` et `front/`.

## À venir

- Scénarios end-to-end Cypress sur les parcours critiques.
- Rapport de couverture (capture d'écran) une fois le MVP complet.
