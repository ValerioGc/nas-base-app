import { runCargo, runCli, runNpm } from '../utils.mjs';

export function prepareRelease(root = process.cwd()) {
  const npm = (name) => runNpm(['run', name], { cwd: root, stdio: 'inherit' });
  const cargo = (...args) => runCargo(args, { cwd: root, stdio: 'inherit' });
  for (const name of [
    'release:check',
    'format:check',
    'lint',
    'type-check',
    'test:unit',
    'test:component',
    'test:e2e',
  ]) {
    npm(name);
  }

  cargo('fmt', '--manifest-path', 'backend/Cargo.toml', '--all', '--check');
  cargo('clippy', '--manifest-path', 'backend/Cargo.toml', '--all-targets', '--', '-D', 'warnings');
  cargo('test', '--locked', '--manifest-path', 'backend/Cargo.toml');

  npm('nas:package');
  npm('nas:test');
}

runCli(import.meta.url, () => prepareRelease());
