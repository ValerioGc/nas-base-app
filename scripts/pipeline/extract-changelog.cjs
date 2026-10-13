const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function extractChangelog(version, root = process.cwd()) {
  const changelog = readFileSync(join(root, 'CHANGELOG.txt'), 'utf8');
  const heading = `## [${version}]`;
  const start = changelog.indexOf(heading);
  if (start === -1) throw new Error(`No changelog entry found for ${version}.`);
  const remaining = changelog.slice(start + heading.length);
  const next = remaining.search(/^## \[/m);
  return (
    next === -1 ? changelog.slice(start) : changelog.slice(start, start + heading.length + next)
  ).trim();
}

const sections = [
  ['Added', ['feat']],
  ['Fixed', ['fix']],
  ['Changed', ['refactor', 'perf', 'docs', 'test', 'chore']],
];

/** Adds the `## [version]` section built from the conventional commit subjects, if missing. */
function addChangelogEntry(changelog, version, subjects) {
  if (changelog.includes(`## [${version}]`)) return changelog;
  if (/^## \[Unreleased\]/im.test(changelog)) {
    return changelog.replace(/^## \[Unreleased\]/im, `## [${version}]`);
  }

  const entries = subjects
    .map((subject) => {
      const prefix = /^(\w+)(?:\([^)]*\))?!?:/.exec(subject);
      if (!prefix) return null;
      const text = subject.slice(prefix[0].length).trimStart();
      return text ? [prefix[0], prefix[1], text] : null;
    })
    .filter((match) => match && !/^(merge )?release v/i.test(match[2]));
  const body = sections
    .map(([title, types]) => {
      const lines = entries
        .filter(([, type]) => types.includes(type.toLowerCase()))
        .map(([, , text]) =>
          `- ${text.charAt(0).toUpperCase()}${text.slice(1)}.`.replace(/\.\.$/, '.'),
        );
      return lines.length ? `### ${title}\n\n${lines.join('\n')}` : '';
    })
    .filter(Boolean);
  const section = `## [${version}]\n\n${body.length ? body.join('\n\n') : '### Changed\n\n- Maintenance release.'}\n\n`;

  const first = changelog.search(/^## \[/m);
  return first === -1
    ? `${changelog.trimEnd()}\n\n${section.trimEnd()}\n`
    : `${changelog.slice(0, first)}${section}${changelog.slice(first)}`;
}

// Run directly, or through the `nas-base-app changelog` command, which loads it as its own.
if (process.argv[1] && require('node:path').resolve(process.argv[1]) === __filename) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node extract-changelog.cjs <version>');
    process.stdout.write(`${extractChangelog(process.argv[2])}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { addChangelogEntry, extractChangelog };
