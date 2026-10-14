import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../../../.github/scripts/prepare-tools.sh', import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'nas-runner-permissions-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const installation = join(root, 'tools with spaces/opt/hostedtoolcache/node/24.21.0/x64');
  const node = join(installation, 'bin/node');
  const npm = join(installation, 'lib/node_modules/npm/bin/npm-cli.js');
  const cargo = join(root, 'home/runner/.cargo');
  const system = join(root, 'usr/local/bin');
  const git = join(root, 'usr/bin/git');
  for (const path of [dirname(node), dirname(npm), join(cargo, 'bin'), system, dirname(git)])
    mkdirSync(path, { recursive: true });
  for (const path of [node, npm, git]) writeFileSync(path, 'tool fixture', { mode: 0o777 });
  symlinkSync(npm, join(dirname(node), 'npm'));
  function openPermissions(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (lstatSync(path).isSymbolicLink()) continue;
      chmodSync(path, 0o777);
      if (entry.isDirectory()) openPermissions(path);
    }
  }
  openPermissions(root);
  const prepare = (selectedSystem = system) =>
    execFileSync(
      '/bin/bash',
      [
        '-c',
        'source "$1"; shift; SYSTEM_DIRECTORIES=("$4"); SYSTEM_EXECUTABLES=("$5"); prepare_tools "$1" "$2" "$3"',
        'runner-permissions',
        script,
        node,
        cargo,
        String(process.getuid()),
        selectedSystem,
        git,
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );
  return { root, installation, node, npm, cargo, system, git, prepare };
}

test('runner preparation protects opt, cache, npm targets, Git, Rust and system ancestors', (t) => {
  const f = fixture(t);
  f.prepare();
  for (const path of [f.node, f.npm, f.git, dirname(f.node), join(f.cargo, 'bin'), f.system]) {
    let selected = path;
    while (selected !== parse(selected).root) {
      if (selected !== tmpdir()) assert.equal(statSync(selected).mode & 0o022, 0, selected);
      selected = dirname(selected);
    }
  }
  assert.equal(statSync(f.node).mode & 0o111, 0o111);
  f.prepare();
});

test('sticky ancestors stay shared while direct PATH entries lose shared write access', (t) => {
  const f = fixture(t);
  const shared = join(f.root, 'shared');
  const privateDirectory = join(shared, 'private');
  mkdirSync(privateDirectory, { recursive: true });
  chmodSync(shared, 0o1777);
  f.prepare(privateDirectory);
  assert.equal(statSync(shared).mode & 0o7777, 0o1777);
  f.prepare(shared);
  assert.equal(statSync(shared).mode & 0o7777, 0o1755);
});

test('symlinked PATH entries protect both their lexical and real ancestors', (t) => {
  const f = fixture(t);
  const aliasParent = join(f.root, 'aliases');
  mkdirSync(aliasParent);
  chmodSync(aliasParent, 0o777);
  const alias = join(aliasParent, 'bin');
  symlinkSync(f.system, alias, 'dir');
  f.prepare(alias);
  assert.equal(statSync(aliasParent).mode & 0o022, 0);
  assert.equal(statSync(dirname(f.system)).mode & 0o022, 0);
});

test('Node links outside the installation are rejected without touching their targets', (t) => {
  const f = fixture(t);
  const external = join(f.root, 'external.js');
  writeFileSync(external, 'outside');
  chmodSync(external, 0o666);
  symlinkSync(external, join(f.installation, 'external-link'));
  assert.throws(() => f.prepare(), /escapes its installation/);
  assert.equal(statSync(external).mode & 0o777, 0o666);
});

test('CI and Publish verify the complete tool environment before installing dependencies', () => {
  const preparations = [];
  for (const file of ['ci.yml', 'publish.yml']) {
    const workflow = readFileSync(`.github/workflows/${file}`, 'utf8');
    const start = workflow.indexOf('      - name: Prepare and verify tool permissions');
    const end = workflow.indexOf('      - name:', start + 1);
    assert.ok(start > workflow.indexOf('uses: actions/setup-node@'));
    assert.ok(start < workflow.indexOf('run: npm ci'));
    const preparation = workflow.slice(start, end);
    assert.ok(preparation.includes('sudo /bin/bash .github/scripts/prepare-tools.sh'));
    assert.ok(preparation.includes('--tool-cache "$RUNNER_TOOL_CACHE"'));
    assert.ok(!preparation.includes('python'));
    assert.ok(preparation.includes('toolEnvironment();'));
    assert.ok(preparation.includes('execToolSync("npm"'));
    assert.ok(preparation.includes('execToolSync("git"'));
    preparations.push(preparation);
  }
  assert.equal(preparations[0], preparations[1]);
});
