// The release of the library itself, with the procedure of the applications: `release:check`,
// `release:test` and `release:merge`. Package, lockfile, changelog and Sonar versions move together;
// the tag pushed by the merge publishes the package to GitHub Packages (publish.yml).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addChangelogEntry, extractChangelog } from './pipeline/extract-changelog.cjs';
import { mergeRelease } from './pipeline/merge_release.mjs';
import { releasePattern } from './pipeline/release-version.mjs';

/** Updates the package, lockfile, changelog and optional Sonar project to `newVersion`. */
export function bumpLibrary(oldVersion, newVersion, subjects = [], root = process.cwd()) {
  if (!releasePattern.test(newVersion)) throw new Error('Invalid release version');
  const read = (name) => readFileSync(resolve(root, name), 'utf8');
  const write = (name, value) => writeFileSync(resolve(root, name), value);
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  if (pkg.version !== oldVersion || lock.version !== oldVersion)
    throw new Error('Inconsistent release metadata');
  pkg.version = newVersion;
  write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  lock.version = newVersion;
  lock.packages[''].version = newVersion;
  write('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
  write('CHANGELOG.txt', addChangelogEntry(read('CHANGELOG.txt'), newVersion, subjects));
  const files = ['package.json', 'package-lock.json', 'CHANGELOG.txt'];
  if (existsSync(resolve(root, 'sonar-project.properties'))) {
    write(
      'sonar-project.properties',
      read('sonar-project.properties').replace(
        /^sonar\.projectVersion=.*$/m,
        `sonar.projectVersion=${newVersion}`,
      ),
    );
    files.push('sonar-project.properties');
  }
  return files;
}

/** The tag, package.json and the changelog say the same version. */
export function verifyLibraryRelease(tag, root = process.cwd()) {
  const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  tag ??= `v${version}`;
  if (!releasePattern.test(tag)) throw new Error(`Invalid release tag ${tag}`);
  const expected = tag.replace(/^v/, '');
  if (version !== expected) throw new Error(`package.json: ${version}, expected ${expected}`);
  extractChangelog(expected, root);
  return expected;
}

/** The gate of a release: what the CI checks, and the package that will be published. */
export function prepareLibraryRelease(root = process.cwd()) {
  for (const name of ['release:check', 'check', 'test:coverage', 'nas:package', 'nas:test'])
    execFileSync('npm', ['run', name], { cwd: root, stdio: 'inherit' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  const option = (name) =>
    args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  try {
    if (command === 'check') {
      console.log(`Release metadata matches v${verifyLibraryRelease(args[0])}.`);
    } else if (command === 'test') {
      prepareLibraryRelease();
    } else if (command === 'merge') {
      mergeRelease({
        type: option('type'),
        branch: option('branch'),
        dryRun: args.includes('--dry-run'),
        bump: bumpLibrary,
        prepare: prepareLibraryRelease,
      });
    } else {
      throw new Error('usage: node scripts/release-library.mjs check [tag] | test | merge');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
