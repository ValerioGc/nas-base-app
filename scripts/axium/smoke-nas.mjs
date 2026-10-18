// Smoke test script for the NAS package.

import { join } from 'node:path';
import { testNasPackage } from './test-nas-package.mjs';
import { readJson, runCli } from '../utils.mjs';

/**
 * Smoke test the NAS package.
 * @param {string[]} args - Command-line arguments to pass to the smoke test.
 * @param {string} root - The root directory of the NAS package.
 * @param {{ env: Record<string, string> }} param2 - Additional options, including environment variables.
 * @returns A promise that resolves when the smoke test completes.
 */
export async function smokeNas(args = [], root = process.cwd(), { env = {} } = {}) {
  const { app } = readJson(join(root, 'nas-app.json'));
  return testNasPackage(
    [
      ...(args.length && !args[0].startsWith('-')
        ? args
        : [
            `release-assets/${app.id}-${app.version}-linux-${process.arch}.tar.gz`,
            '--expected-id',
            app.id,
            '--expected-version',
            app.version,
            '--api-path',
            '/health',
            '--version-field',
            'version',
            ...args,
          ]),
      ...Object.entries(env).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
    ],
    root,
  );
}

await runCli(import.meta.url, () => smokeNas(process.argv.slice(2)), 'FAIL: ');
