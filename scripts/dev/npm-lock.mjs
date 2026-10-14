// Syncs and checks the npm package-lock.json file to ensure it is aligned with package.json.

// --sync regenerates the lockfile without installing; --check verifies alignment.

// Synchronization happens only with pnpm locally, npm and CI use the existing lockfile.

import { resolve } from 'node:path';
import { readJson, runCli, runNpm } from '../utils.mjs';

const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

function fail(message) {
  throw new Error(`package-lock.json: ${message}`);
}

export function syncLock(root = process.cwd()) {
  const agent = process.env.npm_config_user_agent ?? '';
  if (!agent.startsWith('pnpm/') || process.env.CI) {
    return;
  }

  runNpm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: root,
    stdio: 'inherit',
  });
}

/**
 * Checks that the npm package-lock.json file is in sync with package.json.
 * @param {string} root Directory of the project containing package.json and package-lock.json.
 */
export function checkLock(root = process.cwd()) {
  const manifest = readJson(resolve(root, 'package.json'));
  let lock;
  try {
    lock = readJson(resolve(root, 'package-lock.json'));
  } catch {
    fail('missing or unreadable: run pnpm run lock:npm');
  }

  const lockedRoot = lock.packages?.[''] ?? {};
  const differences = FIELDS.flatMap((field) => {
    const wanted = manifest[field] ?? {};
    const locked = lockedRoot[field] ?? {};
    return [...new Set([...Object.keys(wanted), ...Object.keys(locked)])]
      .filter((name) => wanted[name] !== locked[name])
      .map(
        (name) => `  ${name}: package.json ${wanted[name] ?? '-'}, lockfile ${locked[name] ?? '-'}`,
      );
  });

  if (differences.length > 0) {
    fail(
      `not in step with package.json, and npm ci would refuse it:\n${differences.join('\n')}\n` +
        'run pnpm run lock:npm',
    );
  }
}

runCli(import.meta.url, () => {
  const dependency =
    process.env.INIT_CWD !== undefined && resolve(process.env.INIT_CWD) !== resolve('.');

  if (process.argv[2] === '--sync') {
    if (!dependency) syncLock();
  } else if (process.argv[2] === '--check') {
    checkLock();
  } else {
    fail('usage: node npm-lock.mjs --sync | --check');
  }
});
