import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compareVersions, pruneAssets } from '../../../scripts/prune-assets.mjs';

function folder(names) {
  const directory = mkdtempSync(join(tmpdir(), 'prune-assets-'));
  for (const name of names) writeFileSync(join(directory, name), '');
  mkdirSync(join(directory, 'package'));
  return directory;
}

test('orders versions as semver does', () => {
  assert.ok(compareVersions('0.1.10', '0.1.9') > 0);
  assert.ok(compareVersions('0.2.0', '0.1.99') > 0);
  assert.ok(compareVersions('1.0.0-rc.1', '1.0.0') < 0);
  assert.equal(compareVersions('0.1.3', '0.1.3'), 0);
});

test('keeps the release just packaged and the one before it, and nothing else versioned', () => {
  const directory = folder([
    'nas-app-0.1.8-linux-x64.tar.gz',
    'nas-app-0.1.8-linux-x64.tar.gz.sha256',
    'nas-app-0.1.9-linux-x64.tar.gz',
    'nas-app-0.1.9-linux-x64.tar.gz.sha256',
    'nas-app-0.1.10-linux-x64.tar.gz',
    'nas-app-0.1.10-linux-x64.tar.gz.sha256',
    'nas-app-0.1.9-fix-linux-x64.tar.gz',
    // An older name of the same package, and a manual nobody makes here any more.
    'app-0.1.9-linux-x64.tar.gz',
    'nas_os_installation_manual_0.1.9.pdf',
    'notes.txt',
  ]);
  try {
    const removed = pruneAssets(directory, '0.1.10', ['nas-app-']);
    assert.deepEqual(readdirSync(directory).sort(), [
      'nas-app-0.1.10-linux-x64.tar.gz',
      'nas-app-0.1.10-linux-x64.tar.gz.sha256',
      'nas-app-0.1.9-linux-x64.tar.gz',
      'nas-app-0.1.9-linux-x64.tar.gz.sha256',
      'notes.txt',
      'package',
    ]);
    assert.equal(removed.length, 5);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps only the release just packaged when it is the first', () => {
  const directory = folder([
    'valeriogc-nas-base-app-0.1.0.tgz',
    'valeriogc-nas-base-app-0.1.0.tgz.sha256',
  ]);
  try {
    assert.deepEqual(pruneAssets(directory, '0.1.0', ['valeriogc-nas-base-app-']), []);
    assert.equal(readdirSync(directory).length, 3);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
