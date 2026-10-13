import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  checkLock,
  formatSfc,
  verifyRelease,
  extractChangelog,
  nextVersion,
  startBackend,
  coverageRust,
  packageNas,
  bumpVersion,
} from '../../../scripts/index.mjs';
import { backendPackage } from '../../../scripts/backend-paths.mjs';

const tools = new URL('../../../scripts/index.mjs', import.meta.url).href;
const checker = fileURLToPath(
  new URL('../../../scripts/axium/test-nas-package.mjs', import.meta.url),
);

function fixture(t, base = tmpdir()) {
  const root = mkdtempSync(join(base, 'nas-tools-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function json(root, name, value) {
  writeFileSync(join(root, name), `${JSON.stringify(value)}\n`);
}

test('importing all app tools in an empty consumer starts no CLI and writes no files', (t) => {
  const root = fixture(t);
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const tools = await import(${JSON.stringify(tools)}); if (typeof tools.packageNas !== 'function' || typeof tools.startBackend !== 'function') process.exit(2);`,
    ],
    { cwd: root, encoding: 'utf8', timeout: 5000 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.deepEqual(readdirSync(root), []);
});

test('shared lock verification uses the supplied consumer root and includes Vue peers', (t) => {
  const root = fixture(t);
  const manifest = { dependencies: { vue: '3.5.43' }, peerDependencies: { vue: '>=3.5 <4' } };
  json(root, 'package.json', manifest);
  json(root, 'package-lock.json', { packages: { '': manifest } });
  assert.doesNotThrow(() => checkLock(root));
  json(root, 'package-lock.json', {
    packages: { '': { ...manifest, peerDependencies: { vue: '^2' } } },
  });
  assert.throws(() => checkLock(root), /vue.*>=3\.5 <4.*\^2/);
  rmSync(join(root, 'package-lock.json'));
  assert.throws(() => checkLock(root), /missing or unreadable/);
});

test('one release checker reads versions and changelog from two independent consumer roots', (t) => {
  for (const [version, cargo] of [
    ['1.2.3', 'backend/axum/Cargo.toml'],
    ['4.5.6', 'backend/Cargo.toml'],
  ]) {
    const root = fixture(t);
    mkdirSync(join(root, cargo === 'backend/Cargo.toml' ? 'backend' : 'backend/axum'), {
      recursive: true,
    });
    json(root, 'package.json', { version });
    json(root, 'nas-app.json', { app: { version } });
    writeFileSync(join(root, cargo), `[package]\nversion = "${version}"\n`);
    writeFileSync(join(root, 'sonar-project.properties'), `sonar.projectVersion=${version}\n`);
    writeFileSync(
      join(root, 'CHANGELOG.txt'),
      `## [${version}]\n\n### Added\n\n- Consumer feature.\n\n## [0.0.1]\n\n- Older release.\n`,
    );
    assert.equal(verifyRelease(undefined, root), version);
    assert.equal(
      extractChangelog(version, root),
      `## [${version}]\n\n### Added\n\n- Consumer feature.`,
    );
    assert.throws(() => verifyRelease('v999.999.999', root), /expected 999\.999\.999/);
  }
  assert.equal(nextVersion('1.2.3', 'v1.2.3', 'minor'), '1.3.0');
});

test('backend starts from either Cargo layout and accepts the consumer environment', async (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'bin'));
  mkdirSync(join(root, 'backend'));
  writeFileSync(join(root, 'backend/Cargo.toml'), '[package]\nname = "picture"\n');
  json(root, 'nas-app.json', { app: { id: 'sample' } });
  const executable = join(root, 'bin/cargo');
  writeFileSync(
    executable,
    `#!${process.execPath}\nrequire('node:fs').writeFileSync('launch.json', JSON.stringify({ args: process.argv.slice(2), env: { NAS_UI_DIR: process.env.NAS_UI_DIR, FS_EXPLORER_ROOT: process.env.FS_EXPLORER_ROOT } }));\n`,
  );
  chmodSync(executable, 0o755);
  for (const cargo of ['backend/Cargo.toml', 'backend/axum/Cargo.toml']) {
    if (cargo.includes('/axum/')) {
      mkdirSync(join(root, 'backend/axum'));
      writeFileSync(join(root, cargo), '[package]\nname = "axum"\n');
    }
    assert.equal(backendPackage(root), cargo);
    const child = startBackend({
      root,
      socket: '/tmp/fixture.sock',
      env: {
        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        NAS_UI_DIR: 'built-ui',
        FS_EXPLORER_ROOT: '/srv/files',
      },
    });
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
    });
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'launch.json'), 'utf8')), {
      args: ['run', '--manifest-path', cargo, '--', '--listen', '/tmp/fixture.sock'],
      env: { NAS_UI_DIR: 'built-ui', FS_EXPLORER_ROOT: '/srv/files' },
    });
  }
});

test('shared Rust coverage preserves the optional Monitor/Security minimum', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'bin'));
  mkdirSync(join(root, 'backend/src'), { recursive: true });
  writeFileSync(join(root, 'backend/Cargo.toml'), '[package]\nname = "sample"\n');
  writeFileSync(join(root, 'backend/src/main.rs'), 'fn main() {}\n');
  const executable = join(root, 'bin/cargo');
  writeFileSync(
    executable,
    `#!${process.execPath}\nconst fs = require('node:fs'); const args = process.argv.slice(2); fs.writeFileSync('coverage-args.json', JSON.stringify(args)); fs.writeFileSync(args[args.indexOf('--output-path') + 1], 'SF:src/main.rs\\nDA:1,1\\nend_of_record\\n');\n`,
  );
  chmodSync(executable, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${join(root, 'bin')}:${previousPath}`;
  try {
    coverageRust(root, { failUnderLines: 80 });
    const args = JSON.parse(readFileSync(join(root, 'coverage-args.json'), 'utf8'));
    assert.equal(args[args.indexOf('--fail-under-lines') + 1], '80');
    assert.match(
      readFileSync(join(root, 'backend/coverage/lcov.info'), 'utf8'),
      new RegExp(`SF:${join(root, 'backend/src/main.rs')}`),
    );
    assert.throws(() => coverageRust(root, { failUnderLines: 101 }), /between 0 and 100/);
  } finally {
    process.env.PATH = previousPath;
  }
});

test('packaging and release updates support a direct backend crate without Git', (t) => {
  const root = fixture(t);
  for (const directory of ['backend', 'bin', 'dist/axum', 'src/assets'])
    mkdirSync(join(root, directory), { recursive: true });
  writeFileSync(
    join(root, 'backend/Cargo.toml'),
    '[package]\nname = "picture"\nversion = "1.2.3"\n',
  );
  json(root, 'package.json', { version: '1.2.3' });
  json(root, 'nas-app.json', {
    manifest_version: 1,
    app: { id: 'sample', name: 'Sample', version: '1.2.3', icon: 'icon.svg' },
    run: { exec: 'bin/sample' },
    ui: { protocol: 1 },
    provides: [],
    permissions: { paths: [] },
  });
  writeFileSync(join(root, 'dist/axum/index.html'), '<html><body>Sample</body></html>');
  writeFileSync(join(root, 'src/assets/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" />');
  writeFileSync(join(root, 'bin/sample'), '#!/bin/sh\nexit 0\n');
  const executable = join(root, 'bin/cargo');
  writeFileSync(
    executable,
    `#!${process.execPath}\nconst path = require('node:path'); const args = process.argv.slice(2); const manifest = path.resolve(args[args.indexOf('--manifest-path') + 1]); if (manifest !== ${JSON.stringify(join(root, 'backend/Cargo.toml'))}) process.exit(2); process.stdout.write(JSON.stringify({ target_directory: ${JSON.stringify(join(root, 'target'))}, packages: [{ manifest_path: manifest, name: 'sample', version: '1.2.3', targets: [{ kind: ['bin'], name: 'sample' }] }] }));\n`,
  );
  chmodSync(executable, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${join(root, 'bin')}:${previousPath}`;
  try {
    const archive = packageNas({ binary: 'bin/sample' }, root);
    const result = spawnSync(process.execPath, [checker, archive, '--archive-only'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS package/);
    const cli = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('../../../scripts/axium/package-nas.mjs', import.meta.url)),
        '--binary',
        'bin/sample',
      ],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /sample-1\.2\.3-linux-/);
    json(root, 'package-lock.json', { version: '1.2.3', packages: { '': { version: '1.2.3' } } });
    writeFileSync(join(root, 'sonar-project.properties'), 'sonar.projectVersion=1.2.3\n');
    writeFileSync(join(root, 'CHANGELOG.txt'), '## [1.2.3]\n\n### Added\n\n- Initial release.\n');
    const files = bumpVersion('1.2.3', '1.2.4', ['fix: shared tools'], root);
    assert.ok(files.includes('backend/Cargo.toml'));
    assert.ok(!files.includes('backend/axum/Cargo.toml'));
    assert.equal(verifyRelease(undefined, root), '1.2.4');
  } finally {
    process.env.PATH = previousPath;
  }
});

test('formatter uses the consumer config and check mode leaves its source intact', async (t) => {
  const base = resolve('coverage');
  mkdirSync(base, { recursive: true });
  const root = fixture(t, base);
  mkdirSync(join(root, 'src'));
  const file = join(root, 'src/Consumer.vue');
  const source =
    '<script setup lang="ts">\nconst value="hello"\n</script>\n<template><p>{{value}}</p></template>\n';
  writeFileSync(file, source);
  json(root, '.prettierrc.json', { singleQuote: true, semi: true });
  await assert.rejects(formatSfc({ root, checkOnly: true }), /Components requiring formatting/);
  assert.equal(readFileSync(file, 'utf8'), source);
  assert.deepEqual(await formatSfc({ root }), [file]);
  assert.match(
    readFileSync(file, 'utf8'),
    /<script setup lang="ts">\n\nconst value = 'hello';\n\n<\/script>/,
  );
  assert.deepEqual(await formatSfc({ root, checkOnly: true }), []);
});

test('standalone checker accepts CLI help without any project files', (t) => {
  const root = fixture(t);
  const result = spawnSync(process.execPath, [checker, '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Standalone checker/);
  assert.deepEqual(readdirSync(root), []);
});
