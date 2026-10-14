import { runGit } from '../utils.mjs';

export const releasePattern =
  /^v?(?!0\d)\d+\.(?!0\d)\d+\.(?!0\d)\d+(?:-[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)?$/;

/**
 * Mantiene la versione al primo rilascio o se già avanzata; altrimenti incrementa l'ultima rilasciata.
 * @param {string} current Versione del progetto.
 * @param {string | null} latest Ultimo tag raggiungibile, oppure null al primo rilascio.
 * @param {string} [bump='patch'] Tipo di incremento: patch, minor o major.
 * @returns {string} Versione da rilasciare.
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
 * Cerca il tag ammesso più vicino a HEAD tra quelli raggiungibili nei suoi antenati.
 * @param {string} cwd Directory del repository.
 * @returns {string|null} Tag trovato, oppure null al primo rilascio.
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
