# Sécurité

Ce document présente les scans de sécurité du projet, l'analyse de leurs résultats et les décisions prises pour chaque vulnérabilité (corrigée, acceptée ou ignorée), puis résume les choix de sécurité de l'application. La procédure de mise à jour des dépendances est décrite dans [MAINTENANCE.md](MAINTENANCE.md).

## Outils et moment d'exécution

| Outil | Ce qu'il analyse | Commande | Quand |
|---|---|---|---|
| `npm audit` | Vulnérabilités connues des dépendances npm (base GitHub Advisory) | `npm run security:audit` | Hook `pre-push` (bloquant), CI à chaque push et chaque lundi |
| Trivy 0.74 | Dépendances du lockfile, secrets commités par erreur, configuration d'infrastructure, images Docker du `docker-compose.yml` | `npm run security:trivy` | CI à chaque push et chaque lundi |
| oxlint (analyse typée) | Code : promesses non attendues, API dépréciées (`typescript/no-deprecated`), etc. | `npm run lint` | Hook `pre-commit`, CI |
| SonarQube | Code : bugs, failles et points sensibles (*security hotspots*) | voir le README | À la demande, avant chaque livraison |

**Seuil bloquant** : toute vulnérabilité de gravité **haute ou critique**. Pour `npm audit`, le seuil porte sur les dépendances de production (`--omit=dev`) : ce sont elles qui tournent sur le serveur. Le rapport complet (dépendances de développement comprises) est publié dans le résumé de chaque exécution de la CI. Trivy, lui, bloque aussi sur les dépendances de développement (`--include-dev-deps`), qui s'exécutent sur les postes et dans la CI.

**Pourquoi deux scanners de dépendances ?** Ils s'appuient en partie sur les mêmes bases, mais Trivy couvre ce que `npm audit` ignore : les images Docker, les secrets et la configuration. De plus, il permet de documenter une exception (`--skip-files`, `.trivyignore`), alors que `npm audit` n'a pas de mécanisme d'exception. Trivy s'exécute dans son image Docker officielle, épinglée sur une version précise, plutôt que via une action GitHub tierce : rien à installer, et pas de code tiers mis à jour à notre insu dans la CI.

**Pourquoi l'audit au `pre-push` et pas au `pre-commit` ?** Il interroge le registre npm : il est plus lent et dépend du réseau. Surtout, une vulnérabilité publiée dans la nuit peut le faire échouer sans aucun changement de code : bloquer un commit sans rapport avec les dépendances serait contre-productif. La CI le relance de toute façon, y compris chaque lundi sans push (`schedule`), pour détecter une nouvelle alerte sur une dépendance inchangée.

## Résultats du scan initial (10/10/2026)

### `npm audit` : 9 vulnérabilités (6 hautes, 1 modérée, 2 faibles)

| Paquet vulnérable | Gravité | Arrivé par | Avis | Décision |
|---|---|---|---|---|
| `undici` ≤ 6.28 | haute | `@nestjs/mau` | [GHSA-c76h-2ccp-4975](https://github.com/advisories/GHSA-c76h-2ccp-4975) et 16 autres (DoS, injection CRLF, smuggling) | **Corrigée** : dépendance supprimée |
| `tmp` ≤ 0.2.5 | haute | `@nestjs/mau` → `inquirer` → `external-editor` | [GHSA-52f5-9888-hmc6](https://github.com/advisories/GHSA-52f5-9888-hmc6), [GHSA-ph9p-34f9-6g65](https://github.com/advisories/GHSA-ph9p-34f9-6g65) | **Corrigée** : dépendance supprimée |
| `inquirer`, `external-editor` | faible | `@nestjs/mau` | dépendent de `tmp` | **Corrigée** : dépendance supprimée |
| `@nestjs/mau` | modérée | dépendance directe (back) | dépend de `undici` et `inquirer` | **Corrigée** : dépendance supprimée |
| `deepmerge-ts` < 8 | haute | `prisma` → `@prisma/config` | [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) (épuisement de pile sur un objet récursif) | **Corrigée** : `overrides` vers 8.0.2 |
| `mysql2` ≤ 3.23 | haute | `prisma` | [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), [GHSA-rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) | **Corrigée** : `overrides` vers 3.24.5 |
| `prisma`, `@prisma/config` | haute | dépendance directe (back) | dépendent des deux précédents | **Corrigée** par les deux `overrides` |

Analyse :

- **`@nestjs/mau`** est la CLI du service de déploiement payant de NestJS (script `nest deploy`). Le générateur de projet l'ajoute d'office, mais DataShare ne l'utilise pas. À elle seule, elle apportait 5 des 9 vulnérabilités. La supprimer (avec le script `deploy`) est la seule correction propre. `npm audit fix --force` proposait au contraire de la rétrograder en 0.0.6, une version majeure antérieure, ce qui n'aurait rien réglé sur le fond.
- **`prisma`** est une dépendance de développement du back (la CLI : migrations, génération du client). Pourtant, `npm audit --omit=dev` la compte en production, parce que `@prisma/client` la déclare en `peerOptional`. Ce n'est d'ailleurs pas faux, car la CLI sert aussi à appliquer les migrations au déploiement (`prisma migrate deploy`). Le risque réel était faible : `mysql2` n'est chargé que pour une base MySQL (DataShare utilise PostgreSQL), et `deepmerge-ts` ne fusionne que le fichier de configuration de Prisma, jamais une donnée venant d'un utilisateur. Pour autant, `npm audit fix --force` proposait de **rétrograder Prisma en version 6**, soit deux versions majeures en arrière : c'est inacceptable. Les versions corrigées des deux paquets sont donc imposées par le champ `overrides` du `package.json` racine. `mysql2` 3.24.5 reste dans la même version majeure. `deepmerge-ts` 8 est une version majeure, mais Prisma n'en utilise que la fonction `deepmerge`, inchangée (vérifié dans le changelog et dans le code de `@prisma/config`). Après correction, `prisma generate`, les migrations de la base de test, les 43 tests e2e de l'API et les 3 scénarios Cypress passent.
- **À surveiller** : ces `overrides` sont à retirer dès qu'une version de Prisma embarque elles-mêmes les versions corrigées. Voir la procédure dans [MAINTENANCE.md](MAINTENANCE.md).

Résultat après correction : `npm audit` → **0 vulnérabilité**, dépendances de développement comprises.

### Trivy : dépôt et images Docker

| Cible | Résultat | Décision |
|---|---|---|
| `package-lock.json` (dépendances de prod et de dev) | 0 vulnérabilité après les corrections ci-dessus | — |
| Secrets dans le dépôt | 0 | — |
| Configuration d'infrastructure | aucun fichier analysable (Trivy ne prend pas en charge `docker-compose.yml`, et le projet n'a pas encore de Dockerfile) | à revoir quand les Dockerfiles de déploiement arriveront : ils seront analysés sans changer la commande |
| Image `postgres:16-alpine`, paquets Alpine | 0 vulnérabilité | — |
| Image `postgres:16-alpine`, binaire `/usr/local/bin/gosu` | 25 CVE (24 hautes, 1 critique) de la bibliothèque standard Go (`crypto/tls`, `crypto/x509`, `net/url`, `net/http`…), par exemple [CVE-2025-68121](https://avd.aquasec.com/nvd/cve-2025-68121) | **Acceptée** (voir ci-dessous) |

Analyse du cas `gosu` : `gosu` est un petit utilitaire écrit en Go. Le script de démarrage de l'image officielle PostgreSQL s'en sert une seule fois, pour abandonner les droits root et lancer PostgreSQL sous l'utilisateur `postgres`. Il n'ouvre aucune connexion réseau, ne manipule ni TLS ni certificat, n'analyse aucune URL, et il a terminé son travail avant que la base n'accepte la moindre connexion. Les fonctions vulnérables de la bibliothèque standard Go sont bien présentes dans le binaire, mais aucune n'est atteignable. C'est aussi la politique publiée par les mainteneurs de `gosu` ([SECURITY.md de tianon/gosu](https://github.com/tianon/gosu/blob/master/SECURITY.md)) : ils ne reconstruisent pas le binaire pour des CVE Go qui touchent des fonctions qu'il n'appelle jamais, et renvoient vers `govulncheck` pour le vérifier. L'image est déjà la dernière publiée de la branche 16 (vérifié avec `docker pull`) : il n'existe pas de version plus récente à adopter. Ce fichier est donc exclu du scan (`--skip-files usr/local/bin/gosu` dans [scripts/trivy.sh](scripts/trivy.sh)). L'exclusion est limitée à ce seul binaire : le reste de l'image reste analysé et bloquant.

### Ignorées

Aucune vulnérabilité n'a été ignorée sans analyse. Les seules exclusions sont l'exception `gosu` documentée ci-dessus et le choix de ne bloquer `npm audit` que sur les dépendances de production (le rapport complet reste publié dans la CI).

## Décisions de sécurité de l'application

Les arbitrages détaillés sont dans [docs/architecture.md](docs/architecture.md). En résumé :

| Risque | Mesure | Référence |
|---|---|---|
| Vol des mots de passe en cas de fuite de la base | Mots de passe de compte et de fichier hashés et salés (bcrypt, coût 10), jamais renvoyés ni journalisés | US03, US09 |
| Découverte des comptes existants | Même message d'erreur et même temps de réponse (hash factice) pour un email inconnu et un mauvais mot de passe | US04 |
| Usurpation de session | JWT signé (secret dans `JWT_SECRET`), durée de vie limitée (`JWT_EXPIRES_IN`) ; un token présenté mais invalide est refusé (401), jamais dégradé en accès anonyme | US04, US07 |
| Accès au fichier d'autrui | Le propriétaire vient toujours du token, jamais de la requête ; suppression limitée à ses propres fichiers (403) | US05, US06 |
| Lien deviné ou énuméré | Token de téléchargement UUID v4 (122 bits aléatoires), distinct de l'identifiant du fichier | US02 |
| Fichier malveillant | Extensions exécutables refusées (`.exe`, `.bat`, `.sh`…) ; téléchargement toujours en `application/octet-stream` avec `X-Content-Type-Options: nosniff`, pour que le navigateur n'exécute jamais un HTML ou un SVG déposé | US01 |
| Saturation du disque | Taille limitée à 1 Go, reçue en flux et interrompue au dépassement ; lien refusé dès l'expiration. Risque résiduel : la purge quotidienne d'US10 n'est pas réalisée, les fichiers expirés restent sur le disque (cf. `MAINTENANCE.md`) | US01, US10 |
| Champs inattendus dans les requêtes | `ValidationPipe` en liste blanche (`whitelist`) : les propriétés non déclarées sont retirées | toutes |
| Interception | HTTPS jusqu'au proxy dès le développement ; mot de passe de fichier envoyé dans le corps d'un POST, jamais dans l'URL | note « HTTPS en développement » |
| Fuite de données par les logs | Champs journalisés listés explicitement (jamais `Authorization`, cookie ni corps de requête), token de téléchargement tronqué à 8 caractères, aucun email (seulement des identifiants) | note « logs structurés » |

### Risques acceptés pour le MVP

- **Pas de limitation de débit** (*rate limiting*) : l'upload anonyme (US07) permet à n'importe qui d'écrire jusqu'à 1 Go par requête, et la connexion n'est pas protégée contre le *brute force* au-delà du coût de bcrypt. C'est l'évolution prioritaire (`@nestjs/throttler`, ou limitation au niveau du reverse proxy).
- **Token stocké dans le `localStorage`** : il est lisible par un script injecté (XSS). React échappe tout contenu affiché et l'application n'insère aucun HTML brut, ce qui réduit ce risque. Le compromis avec un cookie `httpOnly` est documenté dans [docs/architecture.md](docs/architecture.md).
- **Pas d'en-têtes de sécurité HTTP** (CSP, HSTS…) côté API : ils relèvent du reverse proxy de production, qui sert aussi le front.
- **Pas d'analyse antivirus** des fichiers déposés : le filtrage par extension et le téléchargement forcé en binaire limitent le risque, sans l'éliminer.

## Signaler une vulnérabilité

Ne pas ouvrir d'issue publique : utiliser le signalement privé de GitHub, depuis l'onglet *Security* du dépôt (*Report a vulnerability*).
