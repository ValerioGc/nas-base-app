import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/**
 * Formatter of the Vue components: prettier, plus two rules that prettier cannot enforce.
 *
 * 1. One empty line immediately after the opening and before the closing of `<script>` and `<style>`.
 * 2. An empty line between two adjacent CSS rules.
 *
 * Prettier removes empty lines at the beginning of a block, and it has no option to keep them: for this reason,
 * `.vue` files are in `.prettierignore` and are processed here. The script calls prettier through its
 * API, so the SFCs remain formatted like everything else: with these two additional rules.
 *
 *   node scripts/format-sfc-spacing.mjs:          rewrites the files
 *   node scripts/format-sfc-spacing.mjs --check    only shows which ones need to be rewritten
 */

function findVueFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return findVueFiles(path);
    }

    return path.endsWith('.vue') ? [path] : [];
  });
}

function startsAnotherRule(next) {
  const line = (next ?? '').trim();

  return line !== '' && line !== '}' && !line.startsWith('@else') && !line.startsWith('</');
}

function trimTrailingEmptyLines(lines) {
  while (lines.length > 0 && lines.at(-1).trim() === '') {
    lines.pop();
  }
}

function applySpacing(source) {
  const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  const formatted = [];
  let insideStyle = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const openingTag = /^\s*<(script|style)\b[^>]*>\s*$/.exec(line);
    const closingTag = /^\s*<\/(script|style)>\s*$/.test(line);

    if (openingTag) {
      insideStyle = openingTag[1] === 'style';
      formatted.push(line);

      while (index + 1 < lines.length && lines[index + 1].trim() === '') {
        index += 1;
      }

      formatted.push('');
      continue;
    }

    if (closingTag) {
      trimTrailingEmptyLines(formatted);
      formatted.push('', line);
      insideStyle = false;
      continue;
    }

    formatted.push(line);

    if (insideStyle && line.trim() === '}' && startsAnotherRule(lines[index + 1])) {
      formatted.push('');
    }
  }

  return formatted.join(lineEnding);
}

/** Format SFCs in one consumer without changing the library or the process directory. */
export async function formatSfc({ root = process.cwd(), checkOnly = false } = {}) {
  const { format, resolveConfig } = createRequire(resolve(root, 'package.json'))('prettier');
  const pending = [];
  for (const file of findVueFiles(join(root, 'src'))) {
    const source = readFileSync(file, 'utf8');
    const options = await resolveConfig(file);
    const wanted = applySpacing(await format(source, { ...options, filepath: file }));
    if (wanted === source) continue;
    pending.push(file);
    if (!checkOnly) writeFileSync(file, wanted);
  }
  if (checkOnly && pending.length > 0) {
    const files = pending.map((file) => '  ' + file).join('\n');
    throw new Error(
      `Components requiring formatting (${pending.length}):\n${files}\nFormat with: pnpm run format:sfc`,
    );
  }
  if (!checkOnly && pending.length > 0) console.log(`Components formatted: ${pending.length}`);
  return pending;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await formatSfc({ checkOnly: process.argv.includes('--check') });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
