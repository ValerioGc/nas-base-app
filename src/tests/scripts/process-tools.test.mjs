import assert from 'node:assert/strict';
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

test('a writable ancestor is rejected and compiler wrappers must resolve in trusted directories', (t) => {
  const { root, executable } = fixture(t);
  chmodSync(root, 0o777);
  assert.throws(() => toolPath('cargo', { NAS_CARGO_EXECUTABLE: executable }), /untrusted/);
  assert.throws(
    () => toolEnvironment({ ...process.env, RUSTC_WRAPPER: 'missing-nas-wrapper' }),
    /not found/,
  );
});
