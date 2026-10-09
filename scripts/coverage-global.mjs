// Global coverage report (`npm run test:cov` at the repository root): merges the reports that the back and the front have just written
// (coverage/coverage-final.json, Istanbul format) into a single one, printed and written as HTML in coverage/ at the root, along with the data of the coverage badge.
import { readFileSync, writeFileSync } from 'node:fs';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

/** Minimum required by the specifications, same as the threshold of each package. */
const THRESHOLD = 70;

const coverageMap = libCoverage.createCoverageMap({});
for (const pkg of ['back', 'front']) {
  coverageMap.merge(JSON.parse(readFileSync(`${pkg}/coverage/coverage-final.json`, 'utf8')));
}
// Files without any executable statement (interfaces, DTOs made of decorators only) would be displayed as 0 % covered: left out, as in the
// report of each package.
coverageMap.filter((file) => Object.keys(coverageMap.fileCoverageFor(file).s).length > 0);

const context = libReport.createContext({ dir: 'coverage', coverageMap });
// `json-summary` (coverage/coverage-summary.json) feeds the home page of the published report (scripts/report-site.mjs).
for (const reporter of ['text', 'html', 'json-summary']) reports.create(reporter).execute(context);

const summary = coverageMap.getCoverageSummary();

// Data of the coverage badge of the README (shields.io "endpoint" format), published by the CI (.github/workflows/coverage.yml). The line
// coverage is the figure displayed, as coverage badges usually do.
const lines = summary.lines.pct;
const color = lines < THRESHOLD ? 'red' : lines < 80 ? 'yellow' : lines < 90 ? 'green' : 'brightgreen';
writeFileSync('coverage/badge.json', JSON.stringify({ schemaVersion: 1, label: 'coverage', message: `${lines}%`, color }));

const failed = ['statements', 'branches', 'functions', 'lines'].filter((metric) => summary[metric].pct < THRESHOLD);
if (failed.length > 0) {
  console.error(`Global coverage under ${THRESHOLD} % for: ${failed.join(', ')}`);
  process.exitCode = 1;
}
