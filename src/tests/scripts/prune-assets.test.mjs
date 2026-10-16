import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compareVersions, pruneAssets } from '../../../scripts/pipeline/prune-assets.mjs';

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

test('orders prerelease identifiers numerically and supports hyphenated identifiers', () => {
  const ordered = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
  ];
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(compareVersions(ordered[index - 1], ordered[index]) < 0);
    assert.ok(compareVersions(ordered[index], ordered[index - 1]) > 0);
  }
  assert.ok(compareVersions('1.0.0-rc.10', '1.0.0-rc.2') > 0);
  assert.ok(compareVersions('1.0.0-1', '1.0.0-alpha') < 0);
  assert.ok(compareVersions('1.0.0-rc-beta.2', '1.0.0-rc-beta.10') < 0);
});

test('keeps the nearest preceding prerelease and its checksum across platforms', () => {
  const directory = folder([
    'nas-app-1.0.0-rc.2-linux-x64.tar.gz',
    'nas-app-1.0.0-rc.2-linux-x64.tar.gz.sha256',
    'nas-app-1.0.0-rc.10-linux-x64.tar.gz',
    'nas-app-1.0.0-rc.10-linux-x64.tar.gz.sha256',
    'nas-app-1.0.0-rc.10-linux-arm64.tar.gz',
    'nas-app-1.0.0-rc.11-linux-x64.tar.gz',
    'nas-app-1.0.0-rc.11-linux-x64.tar.gz.sha256',
  ]);
  try {
    assert.deepEqual(pruneAssets(directory, '1.0.0-rc.11', ['nas-app-']).sort(), [
      'nas-app-1.0.0-rc.2-linux-x64.tar.gz',
      'nas-app-1.0.0-rc.2-linux-x64.tar.gz.sha256',
    ]);
    assert.equal(readdirSync(directory).length, 6);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('platforms and archive extensions are not prerelease identifiers', () => {
  for (const suffix of ['-linux-x64.tar.gz', '.tgz', '.tar.gz.sha256', '.pdf', '.sha256']) {
    assert.equal(compareVersions(`nas-app-1.2.3-rc.1${suffix}`, '1.2.3-rc.1'), 0);
    assert.equal(compareVersions(`nas-app-1.2.3${suffix}`, '1.2.3'), 0);
  }
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
    // Archives under an old name and a versioned document outside the package prefix.
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
