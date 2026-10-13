import { spawnSync } from 'node:child_process';
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

mkdirSync('coverage', { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    '--test',
    '--experimental-test-coverage',
    '--test-coverage-include=scripts/**',
    '--test-coverage-exclude=src/tests/**',
    '--test-reporter=spec',
    '--test-reporter-destination=stdout',
    '--test-reporter=lcov',
    '--test-reporter-destination=coverage/scripts.lcov.info',
    ...globSync('src/tests/scripts/*.test.mjs'),
  ],
  { stdio: 'inherit', env: process.env },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const summary = {};
for (const entry of readFileSync('coverage/scripts.lcov.info', 'utf8').split('end_of_record')) {
  const fields = Object.fromEntries(
    entry
      .trim()
      .split('\n')
      .map((line) => {
        const separator = line.indexOf(':');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  if (!fields.SF) continue;
  const percent = (hit, found) => {
    const total = Number(fields[found]);
    const covered = Number(fields[hit]);
    if (!Number.isFinite(total) || !Number.isFinite(covered)) {
      throw new Error(`Invalid coverage counts: ${fields.SF}`);
    }
    return total === 0 ? 100 : (covered * 100) / total;
  };
  summary[resolve(fields.SF)] = {
    lines: percent('LH', 'LF'),
    functions: percent('FNH', 'FNF'),
    branches: percent('BRH', 'BRF'),
  };
}
writeFileSync('coverage/scripts-summary.json', `${JSON.stringify(summary, null, 2)}\n`);
let failed = false;
for (const source of globSync('scripts/**/*.{mjs,cjs}')) {
  const metrics = summary[resolve(source)];
  if (!metrics) {
    console.error(`Coverage missing: ${source}`);
    failed = true;
    continue;
  }
  for (const [metric, value] of Object.entries(metrics)) {
    if (value < 80) {
      console.error(`Coverage below 80%: ${source} (${metric}: ${value.toFixed(2)}%)`);
      failed = true;
    }
  }
}
if (failed) process.exitCode = 1;
