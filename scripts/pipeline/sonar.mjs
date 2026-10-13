import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

export function runSonar(root = process.cwd(), { rust = true } = {}) {
  root = resolve(root);
  if (rust) {
    const output = openSync(resolve(root, 'backend/clippy-report.json'), 'w');
    try {
      const result = spawnSync(
        'cargo',
        [
          'clippy',
          '--manifest-path',
          'backend/Cargo.toml',
          '--all-targets',
          '--message-format=json',
          '--',
          '-D',
          'warnings',
        ],
        { cwd: root, stdio: ['inherit', output, 'inherit'] },
      );
      if (result.error || result.status !== 0) throw result.error ?? new Error('Clippy failed');
    } finally {
      closeSync(output);
    }
  }
  const result = spawnSync(
    'podman',
    [
      'run',
      '--rm',
      '--userns=keep-id:uid=1000,gid=1000',
      '--network',
      'host',
      '-e',
      'SONAR_TOKEN',
      '-e',
      `SONAR_HOST_URL=${process.env.SONAR_HOST_URL ?? 'http://127.0.0.1:9000'}`,
      '-v',
      `${root}:/usr/src:Z`,
      'docker.io/sonarsource/sonar-scanner-cli:latest',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { values } = parseArgs({ options: { 'no-rust': { type: 'boolean', default: false } } });
    runSonar(process.cwd(), { rust: !values['no-rust'] });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
