import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { toolFixture } from '../helpers/script-tools.mjs';

test('lock CLI verifies peers and reports missing or mismatched dependencies', (t) => {
  const f = toolFixture(t);
  const manifest = { dependencies: { sample: '1' }, peerDependencies: { vue: '^3' } };
  f.json('package.json', manifest);
  assert.match(f.cli('npm-lock.mjs', ['--check'], {}, 1).stderr, /missing or unreadable/);
  f.json('package-lock.json', {});
  assert.match(f.cli('npm-lock.mjs', ['--check'], {}, 1).stderr, /sample/);
  f.json('package-lock.json', {
    packages: { '': { ...manifest, optionalDependencies: { extra: '1' } } },
  });
  assert.match(f.cli('npm-lock.mjs', ['--check'], {}, 1).stderr, /extra/);
  f.json('package-lock.json', { packages: { '': manifest } });
  f.cli('npm-lock.mjs', ['--check']);
  assert.match(f.cli('npm-lock.mjs', ['wrong'], {}, 1).stderr, /usage:/);
});

test('lock synchronization runs only for a local pnpm install of the consumer itself', (t) => {
  const f = toolFixture(t);
  f.install('npm');
  f.cli('npm-lock.mjs', ['--sync'], { npm_config_user_agent: 'npm/11', CI: '' });
  f.cli('npm-lock.mjs', ['--sync'], { npm_config_user_agent: 'pnpm/10', CI: 'true' });
  f.cli('npm-lock.mjs', ['--sync'], { npm_config_user_agent: 'pnpm/10', CI: '', INIT_CWD: '/tmp' });
  assert.equal(existsSync(f.env.NAS_TEST_CALLS), false);
  f.cli('npm-lock.mjs', ['--sync'], { npm_config_user_agent: 'pnpm/10', CI: '', INIT_CWD: f.root });
  assert.deepEqual(f.calls(), [
    {
      tool: 'npm',
      args: ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
    },
  ]);
});

test('Rust coverage CLI remaps source paths and rejects invalid limits or unknown sources', (t) => {
  const f = toolFixture(t);
  mkdirSync(join(f.root, 'backend/src'), { recursive: true });
  writeFileSync(join(f.root, 'backend/Cargo.toml'), '[package]\nname = "sample"\n');
  writeFileSync(join(f.root, 'backend/src/main.rs'), 'fn main() {}\n');
  f.install(
    'cargo',
    `fs.writeFileSync(args[args.indexOf('--output-path') + 1], 'SF:' + (process.env.NAS_TEST_SOURCE ?? 'backend/src/main.rs') + '\\nDA:1,1\\nend_of_record\\n');`,
  );
  f.cli('pipeline/coverage-rust.mjs');
  assert.ok(!f.calls()[0].args.includes('--fail-under-lines'));
  f.cli('pipeline/coverage-rust.mjs', ['--fail-under-lines=80'], {
    NAS_TEST_SOURCE: 'src/main.rs',
  });
  assert.match(
    readFileSync(join(f.root, 'backend/coverage/lcov.info'), 'utf8'),
    /SF:.*backend\/src\/main.rs/,
  );
  for (const value of ['NaN', '-1', '101']) {
    assert.match(
      f.cli('pipeline/coverage-rust.mjs', [`--fail-under-lines=${value}`], {}, 1).stderr,
      /between 0 and 100/,
    );
  }
  assert.match(
    f.cli('pipeline/coverage-rust.mjs', [], { NAS_TEST_SOURCE: 'missing.rs' }, 1).stderr,
    /source does not exist/,
  );
});

test('backend CLI forwards termination signals and exits with the child status', async (t) => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const f = toolFixture(t);
    f.json('nas-app.json', { app: { id: 'sample' } });
    mkdirSync(join(f.root, 'backend'));
    writeFileSync(join(f.root, 'backend/Cargo.toml'), '[package]\nname="sample"\n');
    f.install(
      'cargo',
      `process.on('${signal}', () => process.exit(0)); fs.writeFileSync('ready', JSON.stringify({args, ui: process.env.NAS_UI_DIR})); setInterval(() => {}, 1000);`,
    );
    const script = fileURLToPath(
      new URL('../../../scripts/axium/backend-dev.mjs', import.meta.url),
    );
    const child = spawn(process.execPath, [script], {
      cwd: f.root,
      env: { ...f.env, NAS_UI_DIR: '', NAS_APP_SOCKET: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => child.kill('SIGKILL'));
    const exit = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolve(code));
    });
    const deadline = Date.now() + 5000;
    while (!existsSync(join(f.root, 'ready')) && Date.now() < deadline) await delay(10);
    assert.ok(existsSync(join(f.root, 'ready')));
    const started = JSON.parse(readFileSync(join(f.root, 'ready'), 'utf8'));
    assert.deepEqual(started.args.slice(0, 3), ['run', '--manifest-path', 'backend/Cargo.toml']);
    child.kill(signal);
    assert.equal(await exit, 0);
  }
});

test('backend CLI reports failures to start the child and nonzero child exit codes', (t) => {
  const f = toolFixture(t);
  f.json('nas-app.json', { app: { id: 'sample' } });
  mkdirSync(join(f.root, 'backend'));
  writeFileSync(join(f.root, 'backend/Cargo.toml'), '[package]\nname="sample"\n');
  const cargo = f.install('cargo', 'process.exit(3);');
  f.cli('axium/backend-dev.mjs', [], {}, 3);
  writeFileSync(cargo, '#!/missing/nas-interpreter\n');
  assert.match(f.cli('axium/backend-dev.mjs', [], {}, 1).stderr, /ENOENT/);
});
