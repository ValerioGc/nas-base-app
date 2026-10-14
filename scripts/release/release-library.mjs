import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { addChangelogEntry, extractChangelog } from '../pipeline/extract-changelog.cjs';
import { mergeRelease } from './merge_release.mjs';
import { releasePattern } from './release-version.mjs';
import { pruneAssets } from '../pipeline/prune-assets.mjs';
import { optionValue, readJson, runCli, runNpm, writeChecksum, writeJson } from '../utils.mjs';

/**
 * Crea archivio e SHA256, conservando solo la versione corrente e la precedente.
 * @param {string} root Directory della libreria.
 * @returns {string} Percorso dell'archivio creato.
 */
export function packLibrary(root = process.cwd()) {
  const manifest = readJson(resolve(root, 'package.json'));
  const directory = resolve(root, 'release-assets');

  mkdirSync(directory, { recursive: true });

  runNpm(['pack', '--pack-destination', directory], { cwd: root, stdio: 'inherit' });

  const filename = `${manifest.name.replace(/^@/, '').replaceAll('/', '-')}-${manifest.version}.tgz`;
  const archive = join(directory, filename);
  writeChecksum(archive);
  console.log(`Archive and SHA256: ${archive}`);

  const prefix = filename.slice(0, -`${manifest.version}.tgz`.length);
  for (const name of pruneAssets(directory, manifest.version, [prefix])) {
    console.log(`Removed ${name}`);
  }

  return archive;
}

/**
 * Aggiorna versione, lockfile e changelog.
 * @param {string} oldVersion Versione corrente.
 * @param {string} newVersion Nuova versione.
 * @param {string[]} subjects Titoli dei commit da inserire nel changelog.
 * @param {string} root Directory della libreria.
 * @returns {string[]} File aggiornati.
 */
export function bumpLibrary(oldVersion, newVersion, subjects = [], root = process.cwd()) {
  if (!releasePattern.test(newVersion)) {
    throw new Error('Invalid release version');
  }

  const read = (name) => readFileSync(resolve(root, name), 'utf8');
  const write = (name, value) => writeFileSync(resolve(root, name), value);

  const pkg = readJson(resolve(root, 'package.json'));
  const lock = readJson(resolve(root, 'package-lock.json'));
  if (pkg.version !== oldVersion || lock.version !== oldVersion) {
    throw new Error('Inconsistent release metadata');
  }

  pkg.version = newVersion;
  writeJson(resolve(root, 'package.json'), pkg);
  lock.version = newVersion;
  lock.packages[''].version = newVersion;
  writeJson(resolve(root, 'package-lock.json'), lock);

  write('CHANGELOG.txt', addChangelogEntry(read('CHANGELOG.txt'), newVersion, subjects));

  return ['package.json', 'package-lock.json', 'CHANGELOG.txt'];
}

/**
 * Verifica la coerenza tra tag, versione del pacchetto e voce nel changelog.
 * @param {string} tag Tag da verificare.
 * @param {string} root Directory della libreria.
 * @returns {string} Versione verificata.
 */
export function verifyLibraryRelease(tag, root = process.cwd()) {
  const { version } = readJson(resolve(root, 'package.json'));
  tag ??= `v${version}`;
  if (!releasePattern.test(tag)) {
    throw new Error(`Invalid release tag ${tag}`);
  }

  const expected = tag.replace(/^v/, '');
  if (version !== expected) {
    throw new Error(`package.json: ${version}, expected ${expected}`);
  }

  extractChangelog(expected, root);

  return expected;
}

/**
 * Esegue le verifiche della libreria e controlla il pacchetto da pubblicare.
 * @param {string} root Directory della libreria.
 */
export function prepareLibraryRelease(root = process.cwd()) {
  for (const name of ['release:check', 'check', 'test:coverage', 'nas:package', 'nas:test']) {
    runNpm(['run', name], { cwd: root, stdio: 'inherit' });
  }
}

runCli(import.meta.url, () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'check') {
    console.log(`Release metadata matches v${verifyLibraryRelease(args[0])}.`);
  } else if (command === 'test') {
    prepareLibraryRelease();
  } else if (command === 'pack') {
    packLibrary();
  } else if (command === 'merge') {
    mergeRelease({
      type: optionValue(args, 'type'),
      branch: optionValue(args, 'branch'),
      dryRun: args.includes('--dry-run'),
      bump: bumpLibrary,
      prepare: prepareLibraryRelease,
    });
  } else {
    throw new Error(
      'usage: node scripts/release/release-library.mjs check [tag] | test | pack | merge',
    );
  }
});
