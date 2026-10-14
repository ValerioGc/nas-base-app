import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import test from 'node:test';
import { execToolSync, toolEnvironment, toolPath } from '../../../scripts/process-tools.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'nas-trusted-tools-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const executable = join(bin, 'cargo');
  writeFileSync(executable, `#!${process.execPath}\nconsole.log(process.env.PATH);\n`, {
    mode: 0o755,
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, bin, executable };
}

test('tool processes ignore relative, empty and project-writable PATH entries', (t) => {
  const { root, executable } = fixture(t);
  const env = { ...process.env, PATH: `.:${root}::/tmp`, NAS_CARGO_EXECUTABLE: executable };
  const output = execToolSync('cargo', [], { env, encoding: 'utf8' });
  const paths = output.trim().split(':');
  assert.ok(paths.every(isAbsolute));
  assert.ok(!paths.includes(root) && !paths.includes('/tmp') && !paths.includes('.'));
  assert.equal(toolPath('git', env), '/usr/bin/git');
});

test('explicit tools cannot be relative or writable by other users', (t) => {
  const { bin, executable } = fixture(t);
  assert.throws(() => toolPath('cargo', { NAS_CARGO_EXECUTABLE: './cargo' }), /absolute/);
  chmodSync(executable, 0o777);
  assert.throws(() => toolPath('cargo', { NAS_CARGO_EXECUTABLE: executable }), /untrusted/);
  chmodSync(executable, 0o755);
  chmodSync(bin, 0o777);
  assert.throws(() => toolPath('cargo', { NAS_CARGO_EXECUTABLE: executable }), /untrusted/);
});

test('group-writable tools accept private groups and reject shared group membership', (t) => {
  const { bin, executable } = fixture(t);
  chmodSync(bin, 0o775);
  chmodSync(executable, 0o775);
  const module = new URL('../../../scripts/process-tools.mjs', import.meta.url).href;
  const probe = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const [file, scenario] = process.argv.slice(1);
    const uid = process.getuid(), gid = fs.statSync(file).gid;
    const read = fs.readFileSync;
    const accounts = 'root:x:0:0::/root:/bin/sh\\n' +
      'fixture:x:' + uid + ':' + gid + '::/tmp:/bin/sh\\n' +
      'other:x:' + (uid + 10000) + ':' + (scenario === 'primary' ? gid : gid + 1) + '::/tmp:/bin/sh\\n';
    const groups = 'fixture:x:' + gid + ':' + (scenario === 'supplementary' ? 'fixture,other' : 'fixture') + '\\n';
    fs.readFileSync = (path, ...args) => {
      if (path === '/etc/passwd') return accounts;
      if (path === '/etc/group') return groups;
      return read(path, ...args);
    };
    syncBuiltinESMExports();
    const { toolPath } = await import(${JSON.stringify(module)});
    if (scenario === 'private') {
      assert.equal(toolPath('cargo', { NAS_CARGO_EXECUTABLE: file }), file);
      assert.equal(toolPath('cargo', { NAS_CARGO_EXECUTABLE: file }), file);
    } else {
      assert.throws(() => toolPath('cargo', { NAS_CARGO_EXECUTABLE: file }), /untrusted/);
    }
  `;
  for (const scenario of ['private', 'supplementary', 'primary']) {
    execFileSync(process.execPath, ['--input-type=module', '-e', probe, executable, scenario], {
      stdio: 'pipe',
    });
  }
});

test('a writable ancestor is rejected and compiler wrappers must resolve in trusted directories', (t) => {
  const { root, executable } = fixture(t);
  chmodSync(root, 0o777);
  assert.throws(() => toolPath('cargo', { NAS_CARGO_EXECUTABLE: executable }), /untrusted/);
  assert.throws(
    () => toolEnvironment({ ...process.env, RUSTC_WRAPPER: 'missing-nas-wrapper' }),
    /not found/,
  );
});
