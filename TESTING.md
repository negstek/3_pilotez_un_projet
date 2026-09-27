# Plan de tests

Document vivant, complété à chaque fonctionnalité livrée. Les choix d'outils sont justifiés dans [docs/architecture.md](docs/architecture.md) (tableau de synthèse et note « simulation des appels API dans les tests front »).

## Fonctionnalités critiques

Une fonctionnalité est critique quand une défaillance compromet la sécurité des données ou bloque le parcours principal (déposer un fichier, partager le lien, le télécharger). Elles sont testées en priorité, à tous les niveaux pertinents.

| Fonctionnalité | US | Pourquoi elle est critique | État |
|---|---|---|---|
| Création de compte | US03 | Unicité de l'email, mot de passe jamais stocké en clair | Testée |
| Connexion et émission du JWT | US04 | Porte d'entrée de toutes les routes protégées | Testée |
| Protection des routes par JWT | US04 | Empêche l'accès aux fichiers d'un autre utilisateur | Testée (route témoin `GET /auth/me`) |
| Upload avec contrôles (taille, extensions interdites, expiration) | US01, US07, US10 | Parcours principal ; refuse les fichiers dangereux | À venir |
| Téléchargement par lien (lien inconnu, expiré, mot de passe) | US02, US09 | Parcours principal ; seul accès public aux fichiers | À venir |
| Historique et suppression limités au propriétaire | US05, US06 | Confidentialité des fichiers entre utilisateurs | À venir |
| Purge des fichiers expirés | US10 | Les fichiers ne doivent pas survivre à leur expiration | À venir |

## Tests en place

Tous les tests unitaires (back et front) se lancent d'un coup depuis la racine du dépôt avec `npm test`, après un `npm install` à la racine (monorepo npm workspaces). Les commandes ci-dessous lancent les tests d'une seule application.

Le package partagé `shared_lib` (`@datashare/shared-lib`) n'a pas de tests propres : il ne contient que des types et des constantes (limites de saisie, messages d'erreur), sans logique. Ces valeurs sont vérifiées là où elles sont utilisées, par les tests des DTO du back et de la validation du front. Si le package reçoit un jour de la logique, ses tests iront dans `shared_lib/`.

### Back (NestJS) — `cd back`

**Unitaires** (`npm test`, Vitest, dépendances simulées) :

- `src/auth/auth.service.spec.ts` : le mot de passe est stocké sous forme de hash bcrypt salé (jamais en clair, deux hash différents pour un même mot de passe) ; le JWT émis porte l'identifiant et l'email ; le hash n'est jamais renvoyé ; la connexion refuse un mauvais mot de passe, et un email inconnu reçoit le même message.
- `src/auth/dto/auth-dto.spec.ts` : contrôles de saisie de l'inscription et de la connexion (format de l'email, 8 caractères minimum et 72 octets maximum à l'inscription, accents comptés en octets, aucune longueur minimale à la connexion, champs requis, normalisation de l'email).
- `src/users/users.service.spec.ts` : la violation de la contrainte d'unicité sur l'email est traduite en `409`.

**End-to-end API** (`npm run test:e2e`, Supertest + base PostgreSQL `datashare_test`) :

- `test/auth.e2e-spec.ts` : tous les codes de retour du contrat d'API pour `POST /auth/register` (201, 409 y compris avec une casse différente, 422), `POST /auth/login` (200, 401 mot de passe faux, 401 compte inconnu, 422) et `GET /auth/me` (200 avec token, 401 sans token ou avec un token falsifié).

### Front (React) — `cd front`

**Unitaires et composants** (`npm test`, Vitest + React Testing Library, module `src/api/` simulé avec `vi.mock`) :

- `src/auth/validation.test.ts` : règles de saisie côté client (email requis et au bon format, 8 caractères minimum et 72 octets maximum à l'inscription, mot de passe simplement requis à la connexion, confirmation).
- `src/auth/session.test.ts` : restauration de la session, rejet d'un token expiré ou illisible, déconnexion.
- `src/auth/RequireAuth.test.tsx` : redirection d'un visiteur non connecté (ou au token expiré) vers la connexion.
- `src/pages/LoginPage.test.tsx` et `src/pages/RegisterPage.test.tsx` : erreurs affichées sous les champs sans appel à l'API, appel à l'API puis redirection vers l'espace personnel, affichage du message d'erreur renvoyé par l'API (401, 409).
- `src/api/client.test.ts` : en-tête `Authorization: Bearer`, conversion des réponses en erreur, serveur injoignable.
- `src/components/ui/Button.test.tsx` : un bouton désactivé ne déclenche pas d'action.

## Critères d'acceptation

- Tous les tests passent avant chaque commit poussé sur `main`.
- Chaque fonctionnalité critique est couverte par au moins un test unitaire et un test e2e API sur ses cas nominaux et ses cas d'erreur du contrat d'API.
- Couverture visée : 70 % (objectif des spécifications), mesurée par `npm run test:cov` dans `back/` et `front/`.

## À venir

- Scénarios end-to-end Cypress sur les parcours critiques.
- Rapport de couverture (capture d'écran) une fois le MVP complet.
