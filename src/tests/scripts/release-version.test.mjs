import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { nextVersion, latestTag } from '../../../scripts/pipeline/release-version.mjs';
import { mergeRelease } from '../../../scripts/pipeline/merge_release.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'nas-release-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release@example.invalid');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'sample', version: '1.2.3' }));
  git('add', 'package.json');
  git('commit', '-m', 'feat: initial application');
  return { root, git };
}

test('starts the first release at the package version and validates the release type', () => {
  assert.equal(nextVersion('1.2.3', null), '1.2.3');
  assert.equal(nextVersion('1.2.3', 'v1.2.3'), '1.2.4');
  assert.equal(nextVersion('1.2.3', 'v1.2.3', 'minor'), '1.3.0');
  assert.equal(nextVersion('1.2.3', 'v1.2.3', 'major'), '2.0.0');
  assert.equal(nextVersion('1.4.0', 'v1.2.3'), '1.4.0');
  assert.throws(() => nextVersion('invalid', null), /Invalid/);
  assert.throws(() => nextVersion('1.2.3', null, 'invalid'), /Unknown/);
});

test('distinguishes no reachable release tags from actual Git failures', (t) => {
  const { root, git } = fixture(t);
  assert.equal(latestTag(root), null);
  git('tag', 'version-not-a-release');
  assert.equal(latestTag(root), null);
  git('checkout', '-b', 'other');
  writeFileSync(join(root, 'other.txt'), 'other branch');
  git('add', 'other.txt');
  git('commit', '-m', 'feat: other branch');
  git('tag', 'v2.0.0');
  git('checkout', 'main');
  assert.equal(latestTag(root), null);
  git('tag', 'v1.2.2');
  assert.equal(latestTag(root), 'v1.2.2');
  assert.throws(() => latestTag(join(root, 'missing')));
});

test('dry run leaves history, files and tags unchanged without needing a remote', (t) => {
  const { root, git } = fixture(t);
  const previous = process.cwd();
  const head = git('rev-parse', 'HEAD');
  try {
    process.chdir(root);
    assert.equal(mergeRelease({ dryRun: true }), '1.2.3');
    assert.equal(git('tag', '--list'), '');
    assert.equal(git('status', '--porcelain'), '');
    assert.equal(git('rev-parse', 'HEAD'), head);
    writeFileSync(join(root, 'unrelated.txt'), 'user change');
    assert.throws(() => mergeRelease({ dryRun: true }), /not clean/);
  } finally {
    process.chdir(previous);
  }
});
