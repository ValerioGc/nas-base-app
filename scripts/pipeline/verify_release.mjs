import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { extractChangelog } from './extract-changelog.cjs';
import { backendPackage } from '../axium/backend-paths.mjs';
import { releasePattern } from '../release/release-version.mjs';
import { readJson, runCli } from '../utils.mjs';

export function verifyRelease(tag, root = process.cwd()) {
  const read = (path) => readFileSync(resolve(root, path), 'utf8');
  tag ??= `v${readJson(resolve(root, 'package.json')).version}`;

  function cargoVersion(path) {
    const match = /^version\s*=\s*"([^"]+)"/m.exec(read(path));
    if (!match) {
      throw new Error(`${path} has no package version`);
    }

    return match[1];
  }

  if (!tag.startsWith('v') || !releasePattern.test(tag)) {
    throw new Error(`Invalid release tag: ${tag}`);
  }

  const expected = tag.slice(1);
  const cargo = backendPackage(root);
  const versions = {
    'package.json': readJson(resolve(root, 'package.json')).version,
    'nas-app.json': readJson(resolve(root, 'nas-app.json')).app.version,
    [cargo]: cargoVersion(cargo),
  };

  for (const [file, version] of Object.entries(versions)) {
    if (version !== expected) {
      throw new Error(`${file} has version ${version}; expected ${expected}`);
    }
  }
  extractChangelog(expected, root);
  console.log(`Release metadata matches ${tag}.`);

  return expected;
}

runCli(import.meta.url, () => verifyRelease(process.argv[2]), 'Release metadata check failed: ');
