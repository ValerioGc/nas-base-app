import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function toolFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'nas-tool-behavior-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const env = { ...process.env, NAS_TEST_ROOT: root, NAS_TEST_CALLS: join(root, 'calls.jsonl') };
  
  function install(name, body = '') {
    const executable = join(bin, name);
    writeFileSync(
      executable,
      `#!${process.execPath}\nconst fs = require('node:fs');\nconst args = process.argv.slice(2);\nfs.appendFileSync(process.env.NAS_TEST_CALLS, JSON.stringify({tool: ${JSON.stringify(name)}, args}) + '\\n');\nif (process.env.NAS_TEST_FAIL === ${JSON.stringify(name)} + ':' + args[0]) process.exit(7);\n${body}\n`,
      { mode: 0o755 },
    );
    env[`NAS_${name.toUpperCase()}_EXECUTABLE`] = executable;
    return executable;
  }

  const cli = (script, args = [], extraEnv = {}, expected = 0) => {
    const path = fileURLToPath(new URL(`../../../scripts/${script}`, import.meta.url));
    const result = spawnSync(process.execPath, [path, ...args], {
      cwd: root,
      env: { ...env, ...extraEnv },
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, expected, result.stdout + result.stderr);
    return result;
  };
  const calls = () => readFileSync(env.NAS_TEST_CALLS, 'utf8').trim().split('\n').map(JSON.parse);
  const json = (name, value) => writeFileSync(join(root, name), JSON.stringify(value));
  return { root, bin, env, install, cli, calls, json };
}

export function releaseFixture(t) {
  const fixture = toolFixture(t);
  const { root, install, json } = fixture;
  mkdirSync(join(root, 'backend'));
  writeFileSync(
    join(root, 'backend/Cargo.toml'),
    '[package]\nname = "sample"\nversion = "1.2.3"\n',
  );
  writeFileSync(join(root, 'CHANGELOG.txt'), '## [1.2.3]\n\n- Initial.\n');
  json('package.json', { name: 'sample', version: '1.2.3' });
  json('package-lock.json', { version: '1.2.3', packages: { '': { version: '1.2.3' } } });
  json('nas-app.json', { app: { id: 'sample', version: '1.2.3' } });
  install('npm');
  install('cargo', "if (args[0] === 'metadata') console.log('{}');");
  install(
    'git',
    `
if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') console.log(process.env.NAS_TEST_GIT_ROOT ?? process.env.NAS_TEST_ROOT);
if (args[0] === 'rev-parse' && args[1] === '--is-shallow-repository') console.log(process.env.NAS_TEST_SHALLOW ?? 'false');
if (args[0] === 'status') console.log(process.env.NAS_TEST_DIRTY ?? '');
if (args[0] === 'branch') console.log(process.env.NAS_TEST_BRANCH ?? 'feature');
if (args[0] === 'tag' && args[1] === '--list') console.log(process.env.NAS_TEST_EXISTING_TAG ?? '');
if (args[0] === 'tag' && args[1] === '--merged') console.log(process.env.NAS_TEST_LATEST ?? '');
if (args[0] === 'describe') console.log(process.env.NAS_TEST_LATEST);
if (args[0] === 'log') console.log('feat: release feature');
if (args[0] === 'diff') console.log(process.env.NAS_TEST_STAGED ?? 'package.json');
`,
  );
  return fixture;
}
