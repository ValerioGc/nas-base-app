import { runGit } from '../utils.mjs';

export const releasePattern =
  /^v?(?!0\d)\d+\.(?!0\d)\d+\.(?!0\d)\d+(?:-[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)?$/;

/**
 * Keeps the version on the first release or when already ahead, otherwise bumps the last released one.
 * @param {string} current Project version.
 * @param {string | null} latest Latest reachable tag, or null on the first release.
 * @param {string} [bump='patch'] Bump type: patch, minor or major.
 * @returns {string} Version to release.
 */
export function nextVersion(current, latest, bump = 'patch') {
  if (!['patch', 'minor', 'major'].includes(bump)) {
    throw new Error(`Unknown release type "${bump}".`);
  }

  if (!releasePattern.test(current) || (latest && !releasePattern.test(latest))) {
    throw new Error('Invalid release version');
  }

  if (!latest) {
    return current.replace(/^v/, '');
  }

  const parts = (value) => value.replace(/^v/, '').split('-')[0].split('.').map(Number);

  const ahead = parts(current);
  const previous = parts(latest);

  const index = ahead.findIndex((part, i) => part !== previous[i]);
  if (index !== -1 && ahead[index] > previous[index]) {
    return current;
  }

  const [major, minor, patch] = previous;
  return {
    major: `${major + 1}.0.0`,
    minor: `${major}.${minor + 1}.0`,
    patch: `${major}.${minor}.${patch + 1}`,
  }[bump];
}

/**
 * Finds the accepted tag closest to HEAD among its ancestors.
 * @param {string} cwd Repository directory.
 * @returns {string|null} The tag found, or null on the first release.
 */
export function latestTag(cwd = process.cwd()) {
  const git = (...args) => runGit(args, { cwd });

  git('rev-parse', '--verify', 'HEAD');

  const tags = git('tag', '--merged', 'HEAD', '--sort=-version:refname')
    .split('\n')
    .filter((tag) => tag.startsWith('v') && releasePattern.test(tag));

  if (!tags.length) {
    return null;
  }

  return git('describe', '--tags', '--abbrev=0', ...tags.flatMap((tag) => ['--match', tag]));
}
