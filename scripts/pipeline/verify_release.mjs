import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractChangelog } from './extract-changelog.cjs';
import { backendPackage } from '../backend-paths.mjs';
import { releasePattern } from './release-version.mjs';

export function verifyRelease(tag, root = process.cwd()) {
  const read = (path) => readFileSync(resolve(root, path), 'utf8');
  tag ??= `v${JSON.parse(read('package.json')).version}`;
  function cargoVersion(path) {
    const match = /^version\s*=\s*"([^"]+)"/m.exec(read(path));
    if (!match) throw new Error(`${path} has no package version`);
    return match[1];
  }

  function sonarVersion() {
    const match = /^sonar\.projectVersion=(.+)$/m.exec(read('sonar-project.properties'));
    if (!match) throw new Error('sonar-project.properties has no project version');
    return match[1];
  }

  if (!tag.startsWith('v') || !releasePattern.test(tag))
    throw new Error(`Invalid release tag: ${tag}`);
  const expected = tag.slice(1);
  const cargo = backendPackage(root);
  const versions = {
    'package.json': JSON.parse(read('package.json')).version,
    'nas-app.json': JSON.parse(read('nas-app.json')).app.version,
    [cargo]: cargoVersion(cargo),
    'sonar-project.properties': sonarVersion(),
  };
  for (const [file, version] of Object.entries(versions)) {
    if (version !== expected)
      throw new Error(`${file} has version ${version}; expected ${expected}`);
  }
  extractChangelog(expected, root);
  console.log(`Release metadata matches ${tag}.`);
  return expected;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    verifyRelease(process.argv[2]);
  } catch (error) {
    console.error(`Release metadata check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
