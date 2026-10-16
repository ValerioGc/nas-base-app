// Prune old release assets, keeping only the current and the most recent previous version.

import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = /(?<![\d.])(\d+)\.(\d+)\.(\d+)/;
const PRE_RELEASE = /^-(?!linux\b)([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)/;
const EXTENSION = /\.(?:tgz|tar|pdf|sha256)\b/;

function parse(text) {
  const match = VERSION.exec(text);
  if (!match) {
    return null;
  }

  const suffix = text
    .slice(match.index + match[0].length)
    .split(EXTENSION, 1)[0]
    .split('-linux-', 1)[0];

  const pre = PRE_RELEASE.exec(suffix)?.[1] ?? '';

  return {
    text: match[0] + (pre ? `-${pre}` : ''),
    parts: match.slice(1, 4).map(Number),
    pre,
  };
}

function comparePrereleases(left, right) {
  const a = left.split('.');
  const b = right.split('.');

  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] === b[index]) {
      continue;
    }

    const leftNumeric = /^\d+$/.test(a[index]);
    const rightNumeric = /^\d+$/.test(b[index]);
    if (leftNumeric && rightNumeric) {
      return Math.sign(Number(BigInt(a[index]) - BigInt(b[index])));
    }
    if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    }

    return a[index] < b[index] ? -1 : 1;
  }

  return a.length - b.length;
}

// Compare two semantic version strings, including prereleases.
export function compareVersions(left, right) {
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) {
    throw new Error('Invalid release version');
  }

  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) {
      return a.parts[index] - b.parts[index];
    }
  }

  if (a.pre === b.pre) {
    return 0;
  }

  if (!a.pre) {
    return 1;
  }

  if (!b.pre) {
    return -1;
  }

  return comparePrereleases(a.pre, b.pre);
}

/**
 * Keeps the current version and the latest previous one with an accepted prefix.
 * Deletes the other versioned files, under other names too; leaves folders and unversioned files.
 * Returns the deleted names.
 */
export function pruneAssets(directory, version, prefixes) {
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  const own = (name) => prefixes.some((prefix) => name.startsWith(prefix));
  const versionOf = (name) => parse(name)?.text ?? null;

  const previous = files
    .filter(own)
    .map(versionOf)
    .filter((found) => found !== null && compareVersions(found, version) < 0)
    .sort(compareVersions)
    .at(-1);

  const kept = new Set([version, previous].filter(Boolean));
  const removed = files.filter((name) => {
    const found = versionOf(name);
    return found !== null && !(own(name) && kept.has(found));
  });

  for (const name of removed) {
    rmSync(join(directory, name), { force: true });
  }

  return removed;
}
