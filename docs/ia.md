# Utilisation de l'IA dans le développement

Ce document décrit la user story confiée à un copilote IA, **US07 — Upload anonyme**, et le correctif qui a suivi sa relecture. Il précise les tâches assignées, le rôle de supervision et les ajustements apportés.

- **Copilote** : Claude Code (Anthropic), utilisé dans VS Code.
- **User story** : US07, « un utilisateur non authentifié peut déposer un fichier, comme en mode connecté ».
- **Commits** :

| Commit                                                                   | Contenu                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------ |
| `8957637` `feat(ai): upload anonyme, premier jet (IA) (US07)`            | Code généré par l'IA, commité tel quel avant relecture |
| `da8d77d` `fix: corrections sur l'upload anonyme (revue humaine) (US07)` | Corrections décidées à la relecture                    |

## Pourquoi US07

US07 se prête à l'exercice pour trois raisons :

1. Son périmètre est court et bien délimité : les spécifications la définissent par différence avec US01 (« règles de gestion identiques, mais le fichier n'est pas lié à l'identifiant utilisateur »).
2. Elle touche à l'autorisation, le point que la supervision doit contrôler en priorité : elle ouvre aux visiteurs une route jusque-là réservée aux utilisateurs connectés.
3. Elle n'était pas encore développée : la contribution de l'IA pouvait être isolée dans l'historique Git dès le premier commit, sans réécrire l'historique existant.

## Tâches confiées à l'IA

La demande initiale était de produire un premier jet d'US07, sans passer les outils de qualité du projet (Prettier, lint, tests), pour que la relecture porte sur un code brut. Les tâches étaient :

| Tâche                                                 | Résultat dans `8957637`                                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Écrire un guard d'authentification optionnelle        | `back/src/auth/optional-jwt-auth.guard.ts` : `OptionalJwtAuthGuard`, qui laisse passer une requête sans token                |
| Ouvrir la route d'upload aux visiteurs                | `POST /files` utilise ce guard à la place de `JwtAuthGuard` ; le contrôleur transmet un propriétaire `null` pour un visiteur |
| Accepter un fichier sans propriétaire dans le service | `FilesService.upload` reçoit `ownerId: string \| null` ; la colonne `owner_id` était déjà nullable, donc aucune migration    |
| Adapter l'écran d'accueil                             | `HomePage` ne renvoie plus le visiteur vers la connexion avant le choix du fichier                                           |

L'IA a signalé elle-même, dans le message du commit, ce que ce premier jet laissait de côté : aucun test adapté ni ajouté, aucune vérification exécutée, documentation non mise à jour.

## Rôle de supervision

Mon rôle a été de cadrer le travail, de relire ce qui était produit et de décider de ce qui entrait dans le dépôt :

- **Cadrage** : choix de la user story, découpage en tâches, et séparation imposée entre le commit de l'IA et le commit de correction.
- **Relecture du premier jet** : le code a été confronté aux spécifications, au contrat d'API (`docs/api-contract.yaml`) et aux conventions du projet. Cette relecture, a relevé les défauts listés dans la section suivante.
- **Exigences fixées pour la correction** : repasser tous les outils habituels du projet, avec une attention particulière aux commentaires, aux tests et à la documentation.
- **Contrôle de sécurité** : vérification que l'ouverture de la route ne permet ni d'usurper un compte, ni de lister ou de supprimer le fichier d'autrui, et que rien n'est écrit sur le disque pour une requête refusée.

## Correctifs et ajustements

### Défaut de fond : un token invalide devenait un upload anonyme

Le guard du premier jet renvoyait « pas d'utilisateur » dans tous les cas d'échec. Une requête portant un token expiré ou falsifié était donc acceptée comme anonyme.

Conséquence : un utilisateur dont la session venait d'expirer téléversait son fichier sans erreur, recevait un lien valide, mais le fichier n'avait pas de propriétaire. Il n'apparaissait pas dans son historique (US05) et il ne pouvait plus le supprimer (US06).

Correction : le guard distingue désormais trois cas.

| Requête                                                                       | Réponse                                              |
| ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Token valide                                                                  | Fichier rattaché au compte (US01)                    |
| Aucun en-tête `Authorization`                                                 | Upload anonyme, fichier sans propriétaire (US07)     |
| En-tête présent sans token valide (expiré, falsifié, mal formé, autre schéma) | `401`, avant que le fichier soit écrit sur le disque |

Les spécifications sont muettes sur le troisième cas ; le contrat d'API prévoyait déjà ce `401` (« Bearer token fourni mais invalide ou expiré »).

Côté front, ce `401` affiche une invitation à se reconnecter, sans déconnecter l'utilisateur : le déconnecter ferait repartir sa tentative suivante en anonyme, à son insu.

### Autres ajustements

| Défaut du premier jet                                                                                                                                    | Correction                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Types `any` dans le guard et le contrôleur                                                                                                               | Typage strict : le contrôleur reçoit `AuthUser \| null`                                                             |
| Style non conforme (points-virgules, affectation en deux temps)                                                                                          | Prettier repassé, expression simplifiée en `user?.id ?? null`                                                       |
| Commentaires périmés ou absents (« required until US07 », route « reserved to logged-in users »)                                                         | Commentaires du guard, de la route, du service, du décorateur `CurrentUser`, de l'accueil et du formulaire réécrits |
| Deux tests décrivaient encore l'ancien comportement (401 sans token, redirection vers la connexion)                                                      | Tests remplacés par ceux du nouveau comportement                                                                    |
| Aucun test de l'upload anonyme                                                                                                                           | Tests ajoutés (détail ci-dessous)                                                                                   |
| Base de test : les fichiers sans propriétaire n'étaient pas supprimés entre deux tests, la suppression en cascade des utilisateurs ne les atteignant pas | Les tests e2e vident aussi la table des fichiers                                                                    |
| Documentation non mise à jour                                                                                                                            | Note d'architecture US07, légende du schéma, contrat d'API et plan de tests mis à jour                              |

### Tests ajoutés

- **Guard** (`optional-jwt-auth.guard.spec.ts`) : token valide, requête sans en-tête, en-tête invalide (token refusé, autre schéma, en-tête vide), erreur de la stratégie.
- **Service** (`files.service.spec.ts`) : un upload anonyme est enregistré sans propriétaire, avec le même lien.
- **End-to-end** (`files.e2e-spec.ts`) :
  - `201` pour un visiteur, avec les mêmes règles (durée, mot de passe) et un lien téléchargeable ;
  - `422` identiques à ceux d'un utilisateur connecté, sans fichier temporaire laissé ;
  - `401` pour un token falsifié ou illisible, sans fichier créé ;
  - un fichier anonyme n'apparaît dans aucun historique ;
  - un fichier anonyme ne peut être supprimé par personne (`403`).
- **Front** (`HomePage.test.tsx`) : le visiteur téléverse sans token au lieu d'être redirigé ; après un `401`, l'utilisateur reste connecté et sa nouvelle tentative envoie toujours son token.

## Vérifications après correction

| Contrôle                       | Résultat                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| Compilation des trois packages | OK                                                           |
| Prettier                       | conforme                                                     |
| oxlint (analyse typée)         | 0 problème                                                   |
| Tests unitaires                | 10 (shared_lib) + 68 (back) + 72 (front), tous verts         |
| Tests end-to-end de l'API      | 43, tous verts                                               |
| Analyse SonarQube              | aucune alerte sur le code d'US07, 0 hotspot, quality gate OK |

## Décisions consignées

Les arbitrages d'US07 sont détaillés dans la note « mise en œuvre de l'upload anonyme (US07) » de [architecture.md](architecture.md). En résumé :

- **Une seule route pour les deux cas** : les règles « identiques à US01 » des spécifications le sont par construction, sans second chemin de code.
- **Authentification optionnelle, mais jamais ignorée** : un token présenté et invalide est refusé, pas dégradé en anonyme.
- **Un fichier anonyme n'a pas de propriétaire** : personne ne peut le retrouver ni le supprimer ; il disparaît à son expiration.
- **Risque accepté pour le MVP** : l'upload n'exige plus de compte, donc n'importe qui peut écrire jusqu'à 1 Go sur le serveur, sans limite de fréquence. Les spécifications n'en demandent pas ; la limitation par adresse IP est notée comme évolution prioritaire.

## Bilan

Le premier jet était fonctionnel pour le cas nominal, mais il contenait un défaut d'autorisation que ni la compilation ni les tests existants ne signalaient : il fallait confronter le comportement du guard aux user stories voisines (US05, US06) pour le voir. C'est le principal enseignement de l'exercice : sur une fonctionnalité qui touche à l'authentification, la relecture doit porter sur les cas d'échec, pas seulement sur le parcours qui fonctionne.
