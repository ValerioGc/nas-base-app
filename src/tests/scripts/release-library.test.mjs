import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { bumpLibrary, verifyLibraryRelease } from '../../../scripts/release-library.mjs';
import { mergeRelease } from '../../../scripts/pipeline/merge_release.mjs';

function library(t, version = '0.1.0') {
  const root = mkdtempSync(join(tmpdir(), 'nas-library-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: '@valeriogc/nas-base-app', version }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, 'package-lock.json'),
    `${JSON.stringify({ version, packages: { '': { version } } }, null, 2)}\n`,
  );
  writeFileSync(join(root, 'CHANGELOG.txt'), `# Changelog\n\n## [${version}]\n\n- First.\n`);
  return root;
}

test('a library release moves only package.json, its lockfile and the changelog', (t) => {
  const root = library(t);
  assert.equal(verifyLibraryRelease(undefined, root), '0.1.0');
  assert.equal(verifyLibraryRelease('v0.1.0', root), '0.1.0');
  assert.throws(() => verifyLibraryRelease('v0.2.0', root), /expected 0\.2\.0/);
  assert.throws(() => verifyLibraryRelease('latest', root), /Invalid release tag/);

  assert.deepEqual(bumpLibrary('0.1.0', '0.1.1', ['feat: add a component'], root), [
    'package.json',
    'package-lock.json',
    'CHANGELOG.txt',
  ]);
  const read = (name) => readFileSync(join(root, name), 'utf8');
  assert.equal(JSON.parse(read('package.json')).version, '0.1.1');
  assert.equal(JSON.parse(read('package-lock.json')).packages[''].version, '0.1.1');
  assert.match(read('CHANGELOG.txt'), /## \[0\.1\.1\]\n\n### Added\n\n- Add a component\./);
  assert.equal(verifyLibraryRelease(undefined, root), '0.1.1');
  assert.throws(() => bumpLibrary('0.1.0', '0.1.2', [], root), /Inconsistent release metadata/);
  assert.throws(() => bumpLibrary('0.1.1', 'next', [], root), /Invalid release version/);
});

test('the merge of a library runs its own bump and gate, and a dry run touches nothing', (t) => {
  const root = library(t);
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release@example.invalid');
  git('add', '.');
  git('commit', '-m', 'feat: first library');
  const previous = process.cwd();
  const calls = [];
  try {
    process.chdir(root);
    const version = mergeRelease({
      dryRun: true,
      bump: () => calls.push('bump'),
      prepare: () => calls.push('prepare'),
    });
    assert.equal(version, '0.1.0');
    assert.deepEqual(calls, []);
    assert.equal(git('tag', '--list'), '');
    assert.equal(git('status', '--porcelain'), '');
  } finally {
    process.chdir(previous);
  }
});
