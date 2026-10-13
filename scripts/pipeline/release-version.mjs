import { execFileSync } from 'node:child_process';

export const releasePattern =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
export function nextVersion(current, latest, bump = 'patch') {
  if (!['patch', 'minor', 'major'].includes(bump))
    throw new Error(`Unknown release type "${bump}".`);
  if (!releasePattern.test(current) || (latest && !releasePattern.test(latest)))
    throw new Error('Invalid release version');
  if (!latest) return current.replace(/^v/, '');
  const parts = (value) => value.replace(/^v/, '').split('-')[0].split('.').map(Number);
  const ahead = parts(current),
    previous = parts(latest);
  const index = ahead.findIndex((part, i) => part !== previous[i]);
  if (index !== -1 && ahead[index] > previous[index]) return current;
  const [major, minor, patch] = previous;
  return {
    major: `${major + 1}.0.0`,
    minor: `${major}.${minor + 1}.0`,
    patch: `${major}.${minor}.${patch + 1}`,
  }[bump];
}
export function latestTag(cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('rev-parse', '--verify', 'HEAD');
  const tags = git('tag', '--merged', 'HEAD', '--sort=-version:refname')
    .split('\n')
    .filter((tag) => tag.startsWith('v') && releasePattern.test(tag));
  if (!tags.length) return null;
  // Preserve git-describe ancestry selection rather than comparing unrelated branches.
  return git('describe', '--tags', '--abbrev=0', ...tags.flatMap((tag) => ['--match', tag]));
}
