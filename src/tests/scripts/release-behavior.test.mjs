import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { basename, dirname, isAbsolute, join } from 'node:path';
import test from 'node:test';
import { releaseFixture } from '../helpers/script-tools.mjs';
import { bumpVersion, nextPatch } from '../../../scripts/release/bump-version.mjs';
import { prepareRelease } from '../../../scripts/pipeline/prepare_release.mjs';

test('the application release gate invokes Node npm and Rust directly without tool overrides', (t) => {
  const f = releaseFixture(t);
  const original = childProcess.execFileSync;
  const calls = [];
  childProcess.execFileSync = (command, args, options) => calls.push({ command, args, options });
  syncBuiltinESMExports();
  try {
    prepareRelease(f.root);
    assert.equal(calls.length, 12);
    for (const { command, args, options } of calls) {
      assert.equal(options.cwd, f.root);
      assert.equal(options.stdio, 'inherit');
      assert.ok(isAbsolute(command));
      if (args[0] === 'run') assert.equal(command, join(dirname(process.execPath), 'npm'));
      else assert.equal(basename(command), 'cargo');
    }
    assert.deepEqual(
      calls.slice(-2).map(({ args }) => args),
      [
        ['run', 'nas:package'],
        ['run', 'nas:test'],
      ],
    );
  } finally {
    childProcess.execFileSync = original;
    syncBuiltinESMExports();
  }
});

test('application release runs all gates before committing, merging and tagging', (t) => {
  const f = releaseFixture(t);
  f.cli('release/merge_release.mjs', ['--type=minor', '--branch=main'], {
    NAS_TEST_LATEST: 'v1.2.3',
  });
  assert.equal(JSON.parse(readFileSync(join(f.root, 'package.json'), 'utf8')).version, '1.3.0');
  const calls = f.calls();
  assert.deepEqual(
    calls.filter(({ tool }) => tool === 'npm').map(({ args }) => args[1]),
    [
      'lock:npm',
      'format',
      'release:check',
      'format:check',
      'lint',
      'type-check',
      'test:unit',
      'test:component',
      'test:e2e',
      'nas:package',
      'nas:test',
    ],
  );
  const gitCalls = calls.filter(({ tool }) => tool === 'git').map(({ args }) => args);
  assert.ok(gitCalls.some((args) => args[0] === 'log' && args[1] === 'v1.2.3..HEAD'));
  assert.deepEqual(gitCalls.slice(-7), [
    ['commit', '-m', 'chore: release v1.3.0'],
    ['checkout', 'main'],
    ['pull', '--ff-only', 'origin', 'main'],
    ['merge', '--no-ff', '-m', 'chore: merge release v1.3.0', 'feature'],
    ['push', 'origin', 'main'],
    ['tag', '-a', 'v1.3.0', '-m', 'Release v1.3.0'],
    ['push', 'origin', 'refs/tags/v1.3.0'],
  ]);
});

test('library release runs its shorter gate and can tag the current branch without an empty commit', (t) => {
  const f = releaseFixture(t);
  f.cli('release/release-library.mjs', ['merge', '--type=patch', '--branch=main'], {
    NAS_TEST_BRANCH: 'main',
    NAS_TEST_STAGED: '',
  });
  const calls = f.calls();
  assert.deepEqual(
    calls.filter(({ tool }) => tool === 'npm').map(({ args }) => args[1]),
    ['lock:npm', 'format', 'release:check', 'check', 'test:coverage', 'nas:package', 'nas:test'],
  );
  assert.ok(
    !calls.some(
      ({ tool, args }) =>
        tool === 'git' && ['commit', 'checkout', 'pull', 'merge'].includes(args[0]),
    ),
  );
  assert.ok(
    calls.some(({ tool, args }) => tool === 'git' && args[0] === 'tag' && args[2] === 'v1.2.3'),
  );
});

test('release CLI rejects unsafe repository states before running any build or push', (t) => {
  const f = releaseFixture(t);
  for (const [env, message] of [
    [{ NAS_TEST_GIT_ROOT: '/tmp' }, 'repository root'],
    [{ NAS_TEST_DIRTY: ' M package.json' }, 'not clean'],
    [{ NAS_TEST_BRANCH: '' }, 'detached HEAD'],
    [{ NAS_TEST_SHALLOW: 'true' }, 'complete history'],
    [{ NAS_TEST_EXISTING_TAG: 'v1.2.3' }, 'already exists'],
  ]) {
    const result = f.cli('release/merge_release.mjs', [], env, 1);
    assert.match(result.stderr, new RegExp(message));
  }
  assert.ok(f.calls().every(({ tool, args }) => tool === 'git' && args[0] !== 'push'));
});

test('a failed release gate stops before staging, pushing or tagging', (t) => {
  const f = releaseFixture(t);
  f.cli('release/merge_release.mjs', [], { NAS_TEST_FAIL: 'npm:run' }, 1);
  assert.ok(
    !f.calls().some(({ tool, args }) => tool === 'git' && ['add', 'push'].includes(args[0])),
  );
  f.cli('pipeline/prepare_release.mjs');
  f.cli('pipeline/prepare_release.mjs', [], { NAS_TEST_FAIL: 'cargo:fmt' }, 1);
  f.cli('release/release-library.mjs', ['test']);
  assert.match(f.cli('release/release-library.mjs', ['unsupported'], {}, 1).stderr, /usage:/);
  f.cli('release/release-library.mjs', ['check', 'v1.2.3']);
  f.cli('release/release-library.mjs', ['merge', '--dry-run']);
});

test('release metadata checks report missing versions and accept the CLI tag', (t) => {
  const f = releaseFixture(t);
  f.cli('pipeline/verify_release.mjs', ['v1.2.3']);
  assert.match(
    f.cli('pipeline/verify_release.mjs', ['1.2.3'], {}, 1).stderr,
    /Invalid release tag/,
  );
  writeFileSync(join(f.root, 'backend/Cargo.toml'), '[package]\nname = "sample"\n');
  assert.match(f.cli('pipeline/verify_release.mjs', [], {}, 1).stderr, /no package version/);
  writeFileSync(join(f.root, 'backend/Cargo.toml'), '[package]\nversion = "1.2.3"\n');
  f.cli('pipeline/verify_release.mjs');
});

test('version bumps reject inconsistent consumer metadata before rewriting files', (t) => {
  assert.equal(nextPatch('1.2.3'), '1.2.4');
  const f = releaseFixture(t);
  assert.throws(() => bumpVersion('1.2.3', 'invalid', [], f.root), /Invalid release version/);
  for (const [name, contents] of [
    ['package.json', JSON.stringify({ version: '9.9.9' })],
    ['nas-app.json', JSON.stringify({ app: { version: '9.9.9' } })],
    ['backend/Cargo.toml', '[package]\nversion = "9.9.9"\n'],
  ]) {
    const file = join(f.root, name);
    const original = readFileSync(file);
    writeFileSync(file, contents);
    assert.throws(() => bumpVersion('1.2.3', '1.2.4', [], f.root), /Inconsistent release metadata/);
    assert.equal(
      JSON.parse(readFileSync(join(f.root, 'package-lock.json'), 'utf8')).version,
      '1.2.3',
    );
    writeFileSync(file, original);
  }
});

test('application version bumps leave project analysis configuration untouched', (t) => {
  const f = releaseFixture(t);
  const file = join(f.root, 'sonar.properties');
  const contents = 'sonar.projectVersion=9.9.9\n';
  writeFileSync(file, contents);
  f.cli('release/merge_release.mjs', [], { NAS_TEST_LATEST: 'v1.2.3' });
  assert.equal(readFileSync(file, 'utf8'), contents);
  assert.equal(JSON.parse(readFileSync(join(f.root, 'package.json'), 'utf8')).version, '1.2.4');
});
