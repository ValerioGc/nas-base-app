import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return files(path);
    }
    return [path];
  });
}

test('sources have no sibling project imports or forbidden punctuation', () => {
  for (const file of [...files('src'), ...files('scripts')]) {
    const content = readFileSync(file, 'utf8');
    assert(!content.includes(String.fromCodePoint(0x2014)), file);
    assert(!/(?:\.\.\/)+(?:external-apps|nas-launcher|nas-gateway|nas-wizard)/.test(content), file);
  }
});

test('the npm package contains the build and externalizes Vue', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  assert(manifest.files.includes('dist'));
  assert(manifest.peerDependencies.vue);
  assert.equal(manifest.dependencies, undefined);
});

test('shared scripts contain no project analysis references', () => {
  for (const file of files('scripts')) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /sonar/i, file);
    assert.doesNotMatch(file, /sonar/i);
  }
});
