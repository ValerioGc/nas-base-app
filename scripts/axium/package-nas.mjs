#!/usr/bin/env node
// Script to package the NAS application into a reproducible archive.
// Requires GNU tar 1.29 or later.

import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { backendPackage } from './backend-paths.mjs';
import { pruneAssets } from '../pipeline/prune-assets.mjs';
import { readJson, runCli, writeChecksum } from '../utils.mjs';

function run(command, args, options) {
  try {
    return execFileSync(command, args, options);
  } catch (error) {
    if (error.status === 0 && error.code === 'EPERM') return error.stdout;
    throw error;
  }
}

const help = `Usage: node scripts/axium/package-nas.mjs [options]
  --output DIRECTORY   Where to write the asset (default release-assets)
  --version TAG        Release tag to check against the manifest (optional v prefix)
  --manifest FILE      Application manifest (default nas-app.json)
  --cargo FILE         Cargo manifest of the backend (auto: backend/axum or backend)
  --binary FILE        Compiled binary (default: the release binary Cargo names)
  --ui DIRECTORY       Built interface, copied as dist/ (default dist/axum)
  --icon FILE          Source of the icon the manifest declares (default src/assets/logo.svg)
  --help               Show this help
`;

// Ensures that the given path is relative and stays within the package.
function packagePath(value, field) {
  if (typeof value !== 'string' || !value || /[\\\0]/.test(value)) {
    throw new Error(`${field} is not a packaged path: ${value}`);
  }
  if (posix.isAbsolute(value) || value.split('/').includes('..')) {
    throw new Error(`${field} has to stay inside the package: ${value}`);
  }

  return posix.normalize(value);
}

/**
 * Packages the NAS application into a reproducible archive.
 * @param {Record<string, any>} options Options for packaging the NAS application.
 * @param {string} root The root directory of the NAS application.
 * @returns {void} Does not return a value; writes the packaged archive to the output directory.
 */
export function packageNas(options = {}, root = process.cwd()) {
  const values = {
    output: 'release-assets',
    manifest: 'nas-app.json',
    cargo: backendPackage(root),
    ui: 'dist/axum',
    icon: 'src/assets/logo.svg',
    ...options,
  };

  const inside = (path) => resolve(root, path);
  const manifest = readJson(inside(values.manifest));
  const { id, version, icon } = manifest.app ?? {};

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id ?? '')) {
    throw new Error(`Invalid app.id: ${id}`);
  }

  if (!version) {
    throw new Error('The manifest declares no app.version');
  }

  const metadata = JSON.parse(
    run(
      'cargo',
      [
        'metadata',
        '--no-deps',
        '--offline',
        '--format-version',
        '1',
        '--manifest-path',
        inside(values.cargo),
      ],
      { encoding: 'utf8' },
    ),
  );

  const crate = metadata.packages.find(
    (pkg) => resolve(pkg.manifest_path) === inside(values.cargo),
  );
  if (!crate) {
    throw new Error(`Cargo did not return the package for ${values.cargo}`);
  }

  const executableName = (crate.targets.find((target) => target.kind.includes('bin')) ?? crate)
    .name;

  const versions = {
    [values.manifest]: version,
    'package.json': readJson(inside('package.json')).version,
    [values.cargo]: crate.version,
  };
  if (values.version) {
    versions['release tag'] = values.version.replace(/^v/, '');
  }

  for (const [name, value] of Object.entries(versions)) {
    if (value !== version) {
      throw new Error(`${name}: ${value} differs from manifest version ${version}`);
    }
  }

  if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) {
    throw new Error('Build the NAS package natively on Linux x64 or arm64');
  }

  const binary = values.binary
    ? inside(values.binary)
    : join(metadata.target_directory, 'release', executableName);

  if (!existsSync(binary)) {
    throw new Error(`Build the release binary first: ${binary}`);
  }
  if (!existsSync(join(inside(values.ui), 'index.html'))) {
    throw new Error(`Build the interface first: ${join(values.ui, 'index.html')}`);
  }

  const output = inside(values.output);
  mkdirSync(output, { recursive: true });

  const asset = join(output, `${id}-${version}-linux-${process.arch}.tar.gz`);
  const staging = mkdtempSync(join(tmpdir(), 'nas-package-'));
  try {
    const executable = join(staging, packagePath(manifest.run?.exec, 'run.exec'));

    mkdirSync(dirname(executable), { recursive: true });

    copyFileSync(binary, executable);

    chmodSync(executable, 0o755);

    cpSync(inside(values.ui), join(staging, 'dist'), { recursive: true });

    copyFileSync(inside(values.manifest), join(staging, 'nas-app.json'));
    if (icon !== undefined) {
      const source = inside(values.icon);
      if (!existsSync(source)) {
        throw new Error(`The manifest declares an icon, ${source} is not there`);
      }

      copyFileSync(source, join(staging, packagePath(icon, 'app.icon')));
    }

    run('tar', [
      '--create',
      '--use-compress-program=gzip -n -9',
      '--format=posix',

      '--pax-option=delete=atime,delete=ctime',
      '--sort=name',
      '--owner=0',
      '--group=0',
      '--numeric-owner',
      `--mtime=@${process.env.SOURCE_DATE_EPOCH ?? 0}`,
      '--file',
      asset,
      '--directory',
      staging,
      '.',
    ]);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }

  writeChecksum(asset);
  console.log(`${asset} (${statSync(asset).size} bytes)`);

  for (const name of pruneAssets(output, version, [`${id}-`])) {
    console.log(`Removed ${name}`);
  }

  return asset;
}

export function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      output: { type: 'string', default: 'release-assets' },
      version: { type: 'string' },
      manifest: { type: 'string', default: 'nas-app.json' },
      cargo: { type: 'string' },
      binary: { type: 'string' },
      ui: { type: 'string', default: 'dist/axum' },
      icon: { type: 'string', default: 'src/assets/logo.svg' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(help);
    return;
  }

  return packageNas(values);
}

runCli(import.meta.url, () => main(), 'FAIL: ');
