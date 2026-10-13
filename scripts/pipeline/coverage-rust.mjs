import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { backendWorkspace } from '../backend-paths.mjs';

export function coverageRust(root = process.cwd(), { failUnderLines } = {}) {
  if (
    failUnderLines !== undefined &&
    (!Number.isFinite(failUnderLines) || failUnderLines < 0 || failUnderLines > 100)
  ) {
    throw new RangeError('failUnderLines must be between 0 and 100');
  }
  mkdirSync(resolve(root, 'backend/coverage'), { recursive: true });
  const report = resolve(root, 'backend/coverage/lcov.info');
  execFileSync(
    'cargo',
    [
      'llvm-cov',
      '--manifest-path',
      backendWorkspace(root),
      '--lcov',
      '--remap-path-prefix',
      '--ignore-filename-regex',
      'tests/',
      ...(failUnderLines === undefined ? [] : ['--fail-under-lines', String(failUnderLines)]),
      '--output-path',
      report,
    ],
    { cwd: root, stdio: 'inherit' },
  );
  writeFileSync(
    report,
    readFileSync(report, 'utf8').replace(/^SF:(.+)$/gm, (line, file) => {
      if (existsSync(resolve(root, file))) return `SF:${resolve(root, file)}`;
      if (existsSync(resolve(root, 'backend', file))) return `SF:${resolve(root, 'backend', file)}`;
      throw new Error(`Coverage source does not exist: ${file}`);
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { values } = parseArgs({ options: { 'fail-under-lines': { type: 'string' } } });
    coverageRust(process.cwd(), {
      failUnderLines:
        values['fail-under-lines'] === undefined ? undefined : Number(values['fail-under-lines']),
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
