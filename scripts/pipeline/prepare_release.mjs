import { execToolSync } from '../process-tools.mjs';
import { pathToFileURL } from 'node:url';

export function prepareRelease(root = process.cwd()) {
  const npm = (name) => execToolSync('npm', ['run', name], { cwd: root, stdio: 'inherit' });
  const cargo = (...args) => execToolSync('cargo', args, { cwd: root, stdio: 'inherit' });
  for (const name of [
    'release:check',
    'format:check',
    'lint',
    'type-check',
    'test:unit',
    'test:component',
    'test:e2e',
  ])
    npm(name);
  cargo('fmt', '--manifest-path', 'backend/Cargo.toml', '--all', '--check');
  cargo('clippy', '--manifest-path', 'backend/Cargo.toml', '--all-targets', '--', '-D', 'warnings');
  cargo('test', '--locked', '--manifest-path', 'backend/Cargo.toml');
  npm('nas:package');
  npm('nas:test');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    prepareRelease();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
