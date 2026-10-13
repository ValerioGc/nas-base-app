// Keeps package-lock.json, the lockfile the pipelines install from with `npm ci`, in step with
// package.json while the project is installed locally with pnpm.
//
//   node scripts/npm-lock.mjs --sync     # rewrites the lockfile, installs nothing
//   node scripts/npm-lock.mjs --check    # fails when package.json asks for what the lock lacks
//
// pnpm runs the --sync as `postinstall` after an install that changes something. `pnpm add`,
// `update` and `remove` do not run it: `pnpm run lint` runs the --check, which says to run
// `pnpm run lock:npm`. Under npm, as in the pipelines, the --sync does nothing: there the lockfile
// is what installs.

import { execToolSync } from './process-tools.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

function fail(message) {
  throw new Error(`package-lock.json: ${message}`);
}

export function syncLock(root = process.cwd()) {
  const agent = process.env.npm_config_user_agent ?? '';
  if (!agent.startsWith('pnpm/') || process.env.CI) {
    return;
  }
  execToolSync(
    'npm',
    ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: root, stdio: 'inherit' },
  );
}

export function checkLock(root = process.cwd()) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  let lock;
  try {
    lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // As the install script of a dependency (this library inside an application), the lockfile
    // to keep is the application's, which its own install script syncs: nothing to do here.
    const dependency =
      process.env.INIT_CWD !== undefined && resolve(process.env.INIT_CWD) !== resolve('.');
    if (process.argv[2] === '--sync') {
      if (!dependency) syncLock();
    } else if (process.argv[2] === '--check') checkLock();
    else fail('usage: node npm-lock.mjs --sync | --check');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
