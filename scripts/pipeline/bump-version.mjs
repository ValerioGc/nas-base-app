import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { addChangelogEntry } from './extract-changelog.cjs';
import { nextVersion, releasePattern } from './release-version.mjs';
import { backendPackage, backendWorkspace } from '../backend-paths.mjs';
export const nextPatch = (version) => nextVersion(version, `v${version}`, 'patch');

export function bumpVersion(oldVersion, newVersion, subjects = [], root = process.cwd()) {
  if (!releasePattern.test(newVersion)) throw new Error('Invalid release version');
  const read = (name) => readFileSync(resolve(root, name), 'utf8');
  const pkg = JSON.parse(read('package.json'));
  const manifest = JSON.parse(read('nas-app.json'));
  const cargoPath = backendPackage(root);
  const cargo = read(cargoPath);
  const sonar = read('sonar-project.properties');
  if (
    pkg.version !== oldVersion ||
    manifest.app.version !== oldVersion ||
    !cargo.includes(`version = "${oldVersion}"`) ||
    !sonar.includes(`sonar.projectVersion=${oldVersion}`)
  )
    throw new Error('Inconsistent release metadata');
  pkg.version = newVersion;
  writeFileSync(resolve(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  // package-lock.json, which the pipelines install from, repeats the version of the project.
  const lock = JSON.parse(read('package-lock.json'));
  lock.version = newVersion;
  lock.packages[''].version = newVersion;
  writeFileSync(resolve(root, 'package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
  manifest.app.version = newVersion;
  writeFileSync(resolve(root, 'nas-app.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    resolve(root, cargoPath),
    cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`),
  );
  writeFileSync(
    resolve(root, 'sonar-project.properties'),
    sonar.replace(/^sonar\.projectVersion=.*$/m, `sonar.projectVersion=${newVersion}`),
  );
  execFileSync(
    'cargo',
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
    'sonar-project.properties',
    'CHANGELOG.txt',
  ];
}
