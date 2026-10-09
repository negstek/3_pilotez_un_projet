// Assembles, in site/, the static pages published on GitHub Pages by the CI (.github/workflows/coverage.yml) and opened by the coverage
// badge of the README. To be run after `npm run test:cov`, which writes everything gathered here:
//   site/index.html     home page: global coverage figures and links to the detailed reports
//   site/coverage/      global coverage report, file by file (coverage/, written by scripts/coverage-global.mjs)
//   site/tests/<pkg>/   results of each test of the back and of the front (.vitest/, HTML reporter of Vitest)
//   site/coverage.json  data of the badge, read by shields.io
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const THRESHOLD = 70;
const METRICS = [
  ['statements', 'Instructions'],
  ['branches', 'Branches'],
  ['functions', 'Fonctions'],
  ['lines', 'Lignes'],
];

rmSync('site', { recursive: true, force: true });
mkdirSync('site/tests', { recursive: true });
cpSync('coverage', 'site/coverage', { recursive: true });
for (const pkg of ['back', 'front']) cpSync(`${pkg}/.vitest`, `site/tests/${pkg}`, { recursive: true });
// Only used to build this site: not part of the coverage report itself.
for (const file of ['badge.json', 'coverage-summary.json']) rmSync(`site/coverage/${file}`);
cpSync('coverage/badge.json', 'site/coverage.json');
// GitHub Pages runs Jekyll by default, which is useless here and skips some files of the reports.
writeFileSync('site/.nojekyll', '');

const { total } = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const percent = (value) => `${String(value).replace('.', ',')} %`;
const rows = METRICS.map(
  ([metric, label]) =>
    `<tr><th scope="row">${label}</th><td class="${total[metric].pct < THRESHOLD ? 'ko' : 'ok'}">${percent(total[metric].pct)}</td>` +
    `<td>${total[metric].covered} / ${total[metric].total}</td></tr>`,
).join('\n          ');

const repository = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
const commit =
  repository && sha ? `, commit <a href="https://github.com/${repository}/commit/${sha}"><code>${sha.slice(0, 7)}</code></a>` : '';
const date = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' });

writeFileSync(
  'site/index.html',
  `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DataShare — tests et couverture</title>
    <style>
      :root { color-scheme: light dark; --ok: #1a7f37; --ko: #cf222e; --border: #8884; }
      @media (prefers-color-scheme: dark) { :root { --ok: #3fb950; --ko: #f85149; } }
      body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 44rem; margin: 0 auto; padding: 2rem 1rem; }
      table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
      th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
      td { font-variant-numeric: tabular-nums; }
      .ok { color: var(--ok); font-weight: 600; }
      .ko { color: var(--ko); font-weight: 600; }
      li { margin: 0.4rem 0; }
      footer { margin-top: 2rem; font-size: 0.875rem; opacity: 0.75; }
    </style>
  </head>
  <body>
    <h1>DataShare — tests et couverture</h1>
    <p>Rapport de la branche <code>main</code>, généré le ${date}${commit}.</p>

    <h2>Couverture globale (back + front)</h2>
    <table>
      <thead>
        <tr><th scope="col">Mesure</th><th scope="col">Couverture</th><th scope="col">Couvert / total</th></tr>
      </thead>
      <tbody>
          ${rows}
      </tbody>
    </table>
    <p>Seuil exigé par les spécifications : ${THRESHOLD} % sur chaque mesure.</p>
    <ul>
      <li><a href="coverage/">Détail de la couverture, fichier par fichier</a></li>
    </ul>

    <h2>Détail des tests</h2>
    <ul>
      <li><a href="tests/back/">Tests du back</a> : unitaires et intégration de l'API (Vitest, Supertest)</li>
      <li><a href="tests/front/">Tests du front</a> : unitaires et composants (Vitest, React Testing Library)</li>
    </ul>
    <p>Les scénarios end-to-end Cypress ne sont pas exécutés par l'intégration continue : ils n'apparaissent pas ici.</p>

    <footer>Le périmètre de la mesure et le plan de tests sont décrits dans TESTING.md, à la racine du dépôt.</footer>
  </body>
</html>
`,
);
