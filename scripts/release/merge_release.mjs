import { realpathSync } from 'node:fs';

import { bumpVersion } from './bump-version.mjs';
import { latestTag, nextVersion } from './release-version.mjs';
import { prepareRelease } from '../pipeline/prepare_release.mjs';
import { optionValue, readJson, runCli, runGit, runNpm } from '../utils.mjs';

/**
 * Bumps the version, runs the checks, then commits, merges and pushes the tag.
 * @param {Object} options Release options.
 * @param {string} [options.type='patch'] Patch, minor or major bump.
 * @param {string} [options.branch='main'] Target branch.
 * @param {boolean} [options.dryRun=false] Computes the version without changing the repository.
 * @param {Function} [options.bump=bumpVersion] Callback that updates the version files.
 * @param {Function} [options.prepare=prepareRelease] Callback that runs the checks.
 * @returns {string} Version to release.
 */
export function mergeRelease({
  type = 'patch',
  branch = 'main',
  dryRun = false,
  bump = bumpVersion,
  prepare = prepareRelease,
} = {}) {
  const git = (...args) => runGit(args);

  if (realpathSync(git('rev-parse', '--show-toplevel')) !== realpathSync(process.cwd())) {
    throw new Error('Run the release from the application repository root');
  }

  if (git('status', '--porcelain')) {
    throw new Error('The working tree is not clean');
  }

  const currentBranch = git('branch', '--show-current');
  if (!currentBranch) {
    throw new Error('A release requires a branch, not detached HEAD');
  }

  if (git('rev-parse', '--is-shallow-repository') === 'true') {
    throw new Error('Fetch complete history and tags before releasing');
  }

  const latest = latestTag();
  const current = readJson('package.json').version;
  const version = nextVersion(current, latest, type);
  const tag = `v${version}`;

  if (git('tag', '--list', tag)) {
    throw new Error(`Release tag ${tag} already exists`);
  }

  console.log(`${tag} from ${currentBranch} into ${branch} (${latest ?? 'first release'})`);

  if (dryRun) {
    return version;
  }

  const subjects = git(
    'log',
    latest ? `${latest}..HEAD` : 'HEAD',
    '--no-merges',
    '--format=%s',
  ).split('\n');

  bump(current, version, subjects);

  runNpm(['run', 'lock:npm'], { stdio: 'inherit' });

  runNpm(['run', 'format'], { stdio: 'inherit' });

  prepare();
  git('add', '-u');
  if (git('diff', '--cached', '--name-only')) {
    git('commit', '-m', `chore: release ${tag}`);
  }

  if (currentBranch !== branch) {
    git('checkout', branch);
    git('pull', '--ff-only', 'origin', branch);
    git('merge', '--no-ff', '-m', `chore: merge release ${tag}`, currentBranch);
  }

  git('push', 'origin', branch);
  git('tag', '-a', tag, '-m', `Release ${tag}`);
  git('push', 'origin', `refs/tags/${tag}`);

  return version;
}

runCli(import.meta.url, () =>
  mergeRelease({
    type: optionValue(process.argv, 'type'),
    branch: optionValue(process.argv, 'branch'),
    dryRun: process.argv.includes('--dry-run'),
  }),
);
