import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { testNasPackage } from './test-nas-package.mjs';

/**
 * Checks the release archive of the application in `root`. `env` adds the variables it needs on
 * the NAS, as the checker's `--env` options do.
 */
export async function smokeNas(args = [], root = process.cwd(), { env = {} } = {}) {
  const { app } = JSON.parse(readFileSync(join(root, 'nas-app.json'), 'utf8'));
  return testNasPackage(
    [
      // An archive given replaces the defaults; options alone are added to them.
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await smokeNas(process.argv.slice(2));
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
