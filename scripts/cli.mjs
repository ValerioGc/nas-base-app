#!/usr/bin/env node

import { fileURLToPath } from 'node:url';

const commands = {
  'format-sfc': './dev/format-sfc-spacing.mjs',
  lock: './dev/npm-lock.mjs',
  'backend-dev': './axium/backend-dev.mjs',
  package: './axium/package-nas.mjs',
  'test-package': './axium/test-nas-package.mjs',
  smoke: './axium/smoke-nas.mjs',
  'release-check': './pipeline/verify_release.mjs',
  'release-test': './pipeline/prepare_release.mjs',
  'release-merge': './release/merge_release.mjs',
  changelog: './pipeline/extract-changelog.cjs',
};

const [command, ...args] = process.argv.slice(2);
const module = commands[command];

if (module === undefined) {
  console.error(`usage: nas-base-app <${Object.keys(commands).join(' | ')}> [arguments]`);
  process.exitCode = 2;
} else {
  const path = fileURLToPath(new URL(module, import.meta.url));
  process.argv = [process.argv[0], path, ...args];

  if (module.endsWith('.cjs')) {
    const { createRequire } = await import('node:module');
    createRequire(import.meta.url)(path);
  } else {
    await import(path);
  }
}
