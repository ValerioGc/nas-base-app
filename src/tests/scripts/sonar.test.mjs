import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runSonar } from '../../../scripts/pipeline/sonar.mjs';

function fixture(t, cargoStatus = 0) {
  const root = mkdtempSync(join(tmpdir(), 'nas-sonar-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  for (const name of ['cargo', 'podman']) {
    writeFileSync(
      join(bin, name),
      `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync('calls.jsonl', JSON.stringify({ command: '${name}', args: process.argv.slice(2) }) + '\\n');
${name === 'cargo' ? `process.stdout.write('{}\\n'); process.exitCode = ${cargoStatus};` : ''}
`,
      { mode: 0o755 },
    );
  }
  const previousPath = process.env.PATH;
  const previousCode = process.exitCode;
  process.env.PATH = `${bin}:${previousPath}`;
  t.after(() => {
    process.env.PATH = previousPath;
    process.exitCode = previousCode;
    rmSync(root, { recursive: true, force: true });
  });
  const calls = () =>
    readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  return { root, calls };
}

test('the frontend Sonar CLI scans without Cargo or a backend directory', (t) => {
  const { root, calls } = fixture(t);
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('../../../scripts/pipeline/sonar.mjs', import.meta.url)), '--no-rust'],
    { cwd: root },
  );
  const recorded = calls();
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].command, 'podman');
  assert.ok(recorded[0].args.includes('SONAR_TOKEN'));
  assert.ok(recorded[0].args.includes(`${root}:/usr/src:Z`));
  assert.equal(recorded[0].args.at(-1), 'docker.io/sonarsource/sonar-scanner-cli:latest');
  assert.equal(existsSync(join(root, 'backend')), false);
});

test('Rust consumers still collect Clippy before scanning', (t) => {
  const { root, calls } = fixture(t);
  mkdirSync(join(root, 'backend'));
  runSonar(root);
  assert.deepEqual(
    calls().map((call) => call.command),
    ['cargo', 'podman'],
  );
  assert.equal(readFileSync(join(root, 'backend/clippy-report.json'), 'utf8'), '{}\n');
});

test('a failed Clippy check stops before the Sonar scanner', (t) => {
  const failed = fixture(t, 1);
  mkdirSync(join(failed.root, 'backend'));
  assert.throws(() => runSonar(failed.root), /Clippy failed/);
  assert.deepEqual(
    failed.calls().map((call) => call.command),
    ['cargo'],
  );
});
