import { execToolSync } from '../process-tools.mjs';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { prepareRelease } from './prepare_release.mjs';
import { bumpVersion } from './bump-version.mjs';
import { latestTag, nextVersion } from './release-version.mjs';

/**
 * Releases the project in the working directory. `bump` writes the new version and `prepare` runs
 * the gate: those of a NAS application unless a project of another kind gives its own.
 */
export function mergeRelease({
  type = 'patch',
  branch = 'main',
  dryRun = false,
  bump = bumpVersion,
  prepare = prepareRelease,
} = {}) {
  const git = (...args) => execToolSync('git', args, { encoding: 'utf8' }).trim();
  if (realpathSync(git('rev-parse', '--show-toplevel')) !== realpathSync(process.cwd()))
    throw new Error('Run the release from the application repository root');
  if (git('status', '--porcelain')) throw new Error('The working tree is not clean');
  const currentBranch = git('branch', '--show-current');
  if (!currentBranch) throw new Error('A release requires a branch, not detached HEAD');
  if (git('rev-parse', '--is-shallow-repository') === 'true')
    throw new Error('Fetch complete history and tags before releasing');
  const latest = latestTag();
  const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const version = nextVersion(current, latest, type);
  const tag = `v${version}`;
  if (git('tag', '--list', tag)) throw new Error(`Release tag ${tag} already exists`);
  console.log(`${tag} from ${currentBranch} into ${branch} (${latest ?? 'first release'})`);
  if (dryRun) return version;
  const subjects = git(
    'log',
    latest ? `${latest}..HEAD` : 'HEAD',
    '--no-merges',
    '--format=%s',
  ).split('\n');
  bump(current, version, subjects);
  // The pipelines install with `npm ci`: the lockfile goes out in step with package.json, whatever
  // pnpm add, update or remove left behind. Here only, on the machine of who releases: the release
  // gate runs in the pipelines too, where the lockfile is what installs.
  execToolSync('npm', ['run', 'lock:npm'], { stdio: 'inherit' });
  execToolSync('npm', ['run', 'format'], { stdio: 'inherit' });
  prepare();
  git('add', '-u');
  if (git('diff', '--cached', '--name-only')) git('commit', '-m', `chore: release ${tag}`);
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const option = (name) =>
    process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  try {
    mergeRelease({
      type: option('type'),
      branch: option('branch'),
      dryRun: process.argv.includes('--dry-run'),
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
