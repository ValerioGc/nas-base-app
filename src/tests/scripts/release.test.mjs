import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  addChangelogEntry,
  extractChangelog,
} from '../../../scripts/pipeline/extract-changelog.cjs';

test('extracts the section of a version from the changelog of the application', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'nas-changelog-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    join(root, 'CHANGELOG.txt'),
    '# Changelog\n\n## [1.2.3]\n\n### Added\n\n- Feature.\n\n## [1.2.2]\n\n- Older.\n',
  );

  assert.match(extractChangelog('1.2.3', root), /^## \[1\.2\.3\]\n\n### Added\n\n- Feature\./);
  assert.doesNotMatch(extractChangelog('1.2.3', root), /Older/);
  assert.throws(() => extractChangelog('999.999.999', root), /No changelog entry/);
});

test('adds the new version section from the commits since the last tag', () => {
  const changelog = '# Changelog\n\n## [0.1.1]\n\n### Added\n\n- First release.\n';
  const updated = addChangelogEntry(changelog, '0.1.2', [
    'feat: add disk category filters',
    'fix(disks): preserve the selected inventory row',
    'test: cover the release script',
    'chore: release v0.1.1',
    'wip',
  ]);

  assert.equal(
    updated,
    '# Changelog\n\n## [0.1.2]\n\n### Added\n\n- Add disk category filters.\n\n### Fixed\n\n' +
      '- Preserve the selected inventory row.\n\n### Changed\n\n- Cover the release script.\n\n' +
      '## [0.1.1]\n\n### Added\n\n- First release.\n',
  );
  assert.equal(addChangelogEntry(updated, '0.1.2', ['feat: again']), updated);
});

test('renames an unreleased section instead of adding a new one', () => {
  const changelog = '# Changelog\n\n## [Unreleased]\n\n- Pending.\n\n## [0.1.1]\n';
  assert.equal(
    addChangelogEntry(changelog, '0.1.2', ['feat: ignored']),
    '# Changelog\n\n## [0.1.2]\n\n- Pending.\n\n## [0.1.1]\n',
  );
});
