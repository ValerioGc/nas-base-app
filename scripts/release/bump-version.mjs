import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { addChangelogEntry } from '../pipeline/extract-changelog.cjs';
import { nextVersion, releasePattern } from './release-version.mjs';
import { backendPackage, backendWorkspace } from '../axium/backend-paths.mjs';
import { readJson, runCargo, writeJson } from '../utils.mjs';
export const nextPatch = (version) => nextVersion(version, `v${version}`, 'patch');

export function bumpVersion(oldVersion, newVersion, subjects = [], root = process.cwd()) {
  if (!releasePattern.test(newVersion)) {
    throw new Error('Invalid release version');
  }

  const read = (name) => readFileSync(resolve(root, name), 'utf8');
  const pkg = readJson(resolve(root, 'package.json'));
  const manifest = readJson(resolve(root, 'nas-app.json'));
  const cargoPath = backendPackage(root);
  const cargo = read(cargoPath);

  if (
    pkg.version !== oldVersion ||
    manifest.app.version !== oldVersion ||
    !cargo.includes(`version = "${oldVersion}"`)
  ) {
    throw new Error('Inconsistent release metadata');
  }

  pkg.version = newVersion;
  writeJson(resolve(root, 'package.json'), pkg);

  const lock = readJson(resolve(root, 'package-lock.json'));
  lock.version = newVersion;
  lock.packages[''].version = newVersion;
  manifest.app.version = newVersion;

  writeJson(resolve(root, 'package-lock.json'), lock);

  writeJson(resolve(root, 'nas-app.json'), manifest);

  writeFileSync(
    resolve(root, cargoPath),
    cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`),
  );

  runCargo(
    [
      'metadata',
      '--format-version',
      '1',
      '--no-deps',
      '--offline',
      '--manifest-path',
      backendWorkspace(root),
    ],
    { cwd: root, stdio: 'pipe' },
  );

  writeFileSync(
    resolve(root, 'CHANGELOG.txt'),
    addChangelogEntry(read('CHANGELOG.txt'), newVersion, subjects),
  );

  return [
    'package.json',
    'package-lock.json',
    'nas-app.json',
    cargoPath,
    'backend/Cargo.lock',
    'CHANGELOG.txt',
  ];
}
