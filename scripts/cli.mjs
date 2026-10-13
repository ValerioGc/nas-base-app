#!/usr/bin/env node
// One command for the shared tools, run from the root of an application: `nas-base-app <command>`.
// Each command is the CLI of its own module, which reads the application in the working directory.
import { fileURLToPath } from 'node:url';

const commands = {
  'format-sfc': './format-sfc-spacing.mjs',
  lock: './npm-lock.mjs',
  'backend-dev': './axium/backend-dev.mjs',
  package: './axium/package-nas.mjs',
  'test-package': './axium/test-nas-package.mjs',
  smoke: './axium/smoke-nas.mjs',
  'release-check': './pipeline/verify_release.mjs',
  'release-test': './pipeline/prepare_release.mjs',
  'release-merge': './pipeline/merge_release.mjs',
  changelog: './pipeline/extract-changelog.cjs',
  'coverage-rust': './pipeline/coverage-rust.mjs',
  sonar: './pipeline/sonar.mjs',
};

const [command, ...args] = process.argv.slice(2);
const module = commands[command];
if (module === undefined) {
  console.error(`usage: nas-base-app <${Object.keys(commands).join(' | ')}> [arguments]`);
  process.exitCode = 2;
} else {
  // The module runs as if Node had been given its path, with the arguments that follow.
  const path = fileURLToPath(new URL(module, import.meta.url));
  process.argv = [process.argv[0], path, ...args];
  if (module.endsWith('.cjs')) {
    const { createRequire } = await import('node:module');
    createRequire(import.meta.url)(path);
  } else {
    await import(path);
  }
}
