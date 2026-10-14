import assert from 'node:assert/strict';
import childProcess, { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';
import { toolFixture } from '../helpers/script-tools.mjs';
import { packLibrary } from '../../../scripts/release/release-library.mjs';

function application(t) {
  const f = toolFixture(t);
  for (const path of ['backend', 'dist/axum', 'src/assets', 'target/release'])
    mkdirSync(join(f.root, path), { recursive: true });
  writeFileSync(join(f.root, 'backend/Cargo.toml'), '[package]\nname="sample"\nversion="1.2.3"\n');
  writeFileSync(join(f.root, 'dist/axum/index.html'), '<main>Sample</main>');
  writeFileSync(join(f.root, 'src/assets/logo.svg'), '<svg/>');
  writeFileSync(join(f.root, 'target/release/sample'), '#!/bin/sh\nexit 0\n');
  f.json('package.json', { version: '1.2.3' });
  const manifest = {
    manifest_version: 1,
    app: { id: 'sample', name: 'Sample', version: '1.2.3', icon: 'icon.svg' },
    run: { exec: 'bin/sample' },
  };
  f.json('nas-app.json', manifest);
  const metadata = {
    target_directory: join(f.root, 'target'),
    packages: [
      {
        manifest_path: join(f.root, 'backend/Cargo.toml'),
        name: 'sample',
        version: '1.2.3',
        targets: [{ kind: ['bin'], name: 'sample' }],
      },
    ],
  };
  f.install(
    'cargo',
    `console.log(process.env.NAS_TEST_METADATA ?? ${JSON.stringify(JSON.stringify(metadata))});`,
  );
  f.env.PATH = `${f.bin}:${process.env.PATH}`;
  return { ...f, manifest, metadata };
}

test('NAS packaging chooses the Cargo release binary, verifies tags and prunes old assets', (t) => {
  const f = application(t);
  mkdirSync(join(f.root, 'release-assets'));
  const old = join(f.root, 'release-assets', `sample-1.0.0-linux-${process.arch}.tar.gz`);
  writeFileSync(old, 'old');
  f.cli('axium/package-nas.mjs', ['--version=v1.2.3']);
  const archive = join(f.root, 'release-assets', `sample-1.2.3-linux-${process.arch}.tar.gz`);
  assert.ok(existsSync(archive));
  f.cli('axium/test-nas-package.mjs', [archive, '--archive-only']);
  f.metadata.packages[0].targets = [];
  delete f.manifest.app.icon;
  f.json('nas-app.json', f.manifest);
  f.cli('axium/package-nas.mjs', [], {
    NAS_TEST_METADATA: JSON.stringify(f.metadata),
    SOURCE_DATE_EPOCH: '12345',
  });
  f.cli('axium/package-nas.mjs', ['--help']);
  assert.match(
    f.cli('axium/package-nas.mjs', ['--version=v9.9.9'], {}, 1).stderr,
    /differs from manifest/,
  );
});

test('NAS packaging rejects invalid identities, escaping paths and inconsistent Cargo metadata', (t) => {
  const f = application(t);
  const cases = [
    [{ ...f.manifest, app: null }, /Invalid app.id/],
    [{ ...f.manifest, app: { id: 'sample' } }, /no app.version/],
    ...[undefined, '', '../escape', '/escape', 'bad\\path'].map((exec) => [
      { ...f.manifest, run: { exec } },
      /packaged path|stay inside/,
    ]),
    [{ ...f.manifest, app: { ...f.manifest.app, icon: '../escape.svg' } }, /stay inside/],
  ];
  for (const [manifest, message] of cases) {
    f.json('nas-app.json', manifest);
    assert.match(f.cli('axium/package-nas.mjs', [], {}, 1).stderr, message);
  }
  f.json('nas-app.json', f.manifest);
  assert.match(
    f.cli(
      'axium/package-nas.mjs',
      [],
      { NAS_TEST_METADATA: JSON.stringify({ ...f.metadata, packages: [] }) },
      1,
    ).stderr,
    /did not return/,
  );
  f.metadata.packages[0].version = '9.9.9';
  assert.match(
    f.cli('axium/package-nas.mjs', [], { NAS_TEST_METADATA: JSON.stringify(f.metadata) }, 1).stderr,
    /differs from manifest/,
  );
});

test('NAS packaging reports missing build artifacts and cleans staging after tar failure', (t) => {
  const f = application(t);
  for (const [file, message] of [
    ['target/release/sample', /release binary first/],
    ['dist/axum/index.html', /interface first/],
    ['src/assets/logo.svg', /not there/],
  ]) {
    const path = join(f.root, file),
      content = readFileSync(path);
    rmSync(path);
    assert.match(f.cli('axium/package-nas.mjs', [], {}, 1).stderr, message);
    writeFileSync(path, content);
  }
  f.install('tar', 'process.exit(4);');
  f.cli('axium/package-nas.mjs', [], {}, 1);
  const call = f.calls().find(({ tool }) => tool === 'tar');
  assert.ok(call);
  assert.equal(existsSync(call.args[call.args.indexOf('--directory') + 1]), false);
});

test('library packaging writes a sha256sum file and removes releases older than the predecessor', (t) => {
  const f = toolFixture(t);
  f.json('package.json', { name: '@sample/library', version: '1.2.3' });
  mkdirSync(join(f.root, 'release-assets'));
  for (const version of ['1.0.0', '1.2.2'])
    writeFileSync(join(f.root, 'release-assets', `sample-library-${version}.tgz`), 'old');
  f.install(
    'npm',
    "fs.writeFileSync('release-assets/sample-library-1.2.3.tgz', 'packed library');",
  );
  f.cli('release/release-library.mjs', ['pack']);
  const digest = createHash('sha256').update('packed library').digest('hex');
  assert.equal(
    readFileSync(join(f.root, 'release-assets/sample-library-1.2.3.tgz.sha256'), 'utf8'),
    `${digest}  sample-library-1.2.3.tgz\n`,
  );
  assert.equal(existsSync(join(f.root, 'release-assets/sample-library-1.0.0.tgz')), false);
  assert.equal(existsSync(join(f.root, 'release-assets/sample-library-1.2.2.tgz')), true);
});

test('library packaging uses npm from the active Node installation without a tool override', (t) => {
  const f = toolFixture(t);
  f.json('package.json', { name: '@sample/library', version: '1.2.3' });
  const original = childProcess.execFileSync;
  childProcess.execFileSync = (command, args, options) => {
    assert.equal(command, join(dirname(process.execPath), 'npm'));
    assert.deepEqual(args, ['pack', '--pack-destination', join(f.root, 'release-assets')]);
    assert.equal(options.cwd, f.root);
    writeFileSync(join(f.root, 'release-assets/sample-library-1.2.3.tgz'), 'packed library');
  };
  syncBuiltinESMExports();
  try {
    const archive = packLibrary(f.root);
    const digest = createHash('sha256').update('packed library').digest('hex');
    assert.equal(
      readFileSync(`${archive}.sha256`, 'utf8'),
      `${digest}  sample-library-1.2.3.tgz\n`,
    );
  } finally {
    childProcess.execFileSync = original;
    syncBuiltinESMExports();
  }
});

test('the packed library works in an isolated Vue, TypeScript, Sass and Node consumer', (t) => {
  const f = toolFixture(t);
  const project = process.cwd();
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  f.json('package.json', manifest);
  for (const source of [
    'src',
    'scripts',
    ...globSync('tsconfig*.json'),
    ...globSync('*.config.ts'),
  ]) {
    cpSync(join(project, source), join(f.root, source), { recursive: true });
  }
  symlinkSync(join(project, 'node_modules'), join(f.root, 'node_modules'), 'dir');
  const output = join(f.root, 'release-assets');
  mkdirSync(output);
  const npm = join(dirname(process.execPath), 'npm');
  execFileSync(npm, ['run', 'build'], {
    cwd: f.root,
    encoding: 'utf8',
    env: process.env,
    timeout: 60000,
  });

  for (const source of globSync('src/styles/**/*.scss')) {
    const output = join(f.root, 'dist/styles', relative('src/styles', source));
    assert.deepEqual(readFileSync(output), readFileSync(join(project, source)));
  }
  
  assert.equal(existsSync(join(f.root, 'dist/styles/style.ts')), false);
  const packed = JSON.parse(
    execFileSync(npm, ['pack', '--ignore-scripts', '--pack-destination', output, '--json'], {
      cwd: f.root,
      encoding: 'utf8',
      env: process.env,
    }),
  );

  const filename = packed[0].filename;
  const digest = createHash('sha256')
    .update(readFileSync(join(output, filename)))
    .digest('hex');
  writeFileSync(join(output, `${filename}.sha256`), `${digest}  ${filename}\n`);
  assert.match(f.cli('pipeline/test-package.mjs').stdout, /Package verified:/);
});
