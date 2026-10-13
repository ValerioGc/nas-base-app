import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { smokeNas } from '../../../scripts/axium/smoke-nas.mjs';
import { gzipSync } from 'node:zlib';

const checker = fileURLToPath(
  new URL('../../../scripts/axium/test-nas-package.mjs', import.meta.url),
);
const server = `#!${process.execPath}
const { createServer } = require('node:http');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
createServer((req, res) => {
  let mime, body;
  if (req.url === '/') {
    mime = 'text/html';
    body = '<html><link rel="stylesheet" href="/app.css"><script src="/app.js"></script></html>';
  } else if (req.url === '/app.js' && existsSync(root + '/app.js')) {
    mime = 'text/javascript'; body = readFileSync(root + '/app.js');
  } else if (req.url === '/app.css') {
    mime = 'text/css'; body = 'body { color: black; }';
  } else if (req.url === '/health') {
    mime = 'application/json'; body = JSON.stringify({ version: '1.2.3' });
  } else { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime }); res.end(body);
}).listen(process.argv[process.argv.indexOf('--listen') + 1]);
`;

// Small independent USTAR fixture writer: do not use the checker's parser to make fixtures.
function tar(entries) {
  const chunks = [];

  for (const { name, data = '', mode = 0o644, type = '0', target = '' } of entries) {
    const body = Buffer.from(data);
    const header = Buffer.alloc(512);

    header.write(name, 0, 100);
    header.write(`${mode.toString(8).padStart(7, '0')}\0`, 100, 8);
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124, 12);
    header.fill(32, 148, 156);
    header.write(type, 156, 1);
    header.write(target, 157, 100);
    header.write('ustar\0', 257, 6);

    const sum = header.reduce((total, byte) => total + byte, 0);

    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8);
    chunks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }

  return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'nas-checker-test-'));

  t.after(() => rmSync(root, { recursive: true, force: true }));

  const archive = join(root, `sample-1.2.3-linux-${process.arch}.tar.gz`);
  const manifest = {
    manifest_version: 1,
    app: { id: 'sample', name: 'Sample', version: '1.2.3', icon: 'icon.svg' },
    run: { exec: 'bin/sample', socket: '/run/nas-os/apps/sample.sock' },
    ui: { protocol: 1 },
    provides: [],
    permissions: { paths: [] },
  };
  const entries = [
    { name: 'nas-app.json', data: JSON.stringify(manifest) },
    { name: 'bin/sample', data: server, mode: 0o755 },
    { name: 'icon.svg', data: '<svg/>' },
    { name: 'app.js', data: 'console.log("installed");' },
  ];

  function checksum() {
    const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');

    writeFileSync(`${archive}.sha256`, `${digest}  ${basename(archive)}\n`);
  }

  function pack(values = entries) {
    writeFileSync(archive, gzipSync(tar(values)));
    checksum();
  }

  function run(args = [], expected = 0, message = 'PASS', script = checker) {
    const result = spawnSync(process.execPath, [script, archive, '--timeout', '2', ...args], {
      encoding: 'utf8',
      timeout: 15000,
    });

    assert.ifError(result.error);

    const output = result.stdout + result.stderr;

    assert.equal(result.status, expected, output);
    assert.ok(output.includes(message), output);
  }

  return { root, archive, entries, pack, run, checksum };
}

test('copied standalone checker runs app and all HTML assets from unrelated working directory', (t) => {
  const f = fixture(t);

  f.pack();

  const copy = join(f.root, 'standalone.mjs');

  copyFileSync(checker, copy);
  f.run(
    ['--expected-id', 'sample', '--expected-version', 'v1.2.3', '--version-field', 'version'],
    0,
    '2 local assets',
    copy,
  );
});

test('archive-only does not execute the program', (t) => {
  const f = fixture(t);

  f.entries[1].data = 'not an executable';
  f.pack();
  f.run(['--archive-only']);
});

test('finds the local release archive from the manifest', (t) => {
  const f = fixture(t);
  f.pack();
  const output = join(f.root, 'release-assets');
  mkdirSync(output);
  copyFileSync(f.archive, join(output, basename(f.archive)));
  copyFileSync(`${f.archive}.sha256`, join(output, `${basename(f.archive)}.sha256`));
  writeFileSync(join(f.root, 'nas-app.json'), f.entries[0].data);

  const result = spawnSync(process.execPath, [checker, '--archive-only'], {
    cwd: f.root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS package/);
});

test('corrupt archive is rejected before extraction', (t) => {
  const f = fixture(t);

  f.pack();
  appendFileSync(f.archive, 'corruption');
  f.run(['--archive-only'], 1, 'checksum mismatch');
});

for (const path of ['../escaped', '/tmp/nas-escaped']) {
  test(`rejects unsafe path ${path}`, (t) => {
    const f = fixture(t);

    f.pack([...f.entries, { name: path, data: 'bad' }]);
    f.run(['--archive-only'], 1, 'Unsafe package path');
  });
}

test('requires manifest at archive root', (t) => {
  const f = fixture(t);

  f.pack(f.entries.slice(1));
  f.run(['--archive-only'], 1, 'nas-app.json missing');
});

test('requires executable bit', (t) => {
  const f = fixture(t);

  f.entries[1].mode = 0o644;
  f.pack();
  f.run(['--archive-only'], 1, 'not executable');
});

test('checks expected release version', (t) => {
  const f = fixture(t);

  f.pack();
  f.run(['--archive-only', '--expected-version', '2.0.0'], 1, 'does not match --expected-version');
});

test('does not hide missing asset behind working front page', (t) => {
  const f = fixture(t);

  f.pack(f.entries.slice(0, -1));
  f.run([], 1, '404');
});

test('requires working API', (t) => {
  const f = fixture(t);

  f.pack();
  f.run(['--api-path', '/missing'], 1, '404');
});

test('checks runtime version', (t) => {
  const f = fixture(t);

  f.entries[1].data = server.replace("version: '1.2.3'", "version: '0.0.0'");
  f.pack();
  f.run(['--version-field', 'version'], 1, 'runtime version differs');
});

test('rejects public listener', (t) => {
  const f = fixture(t);

  f.entries[1].data = server.replace(
    "}).listen(process.argv[process.argv.indexOf('--listen') + 1]);",
    "}).listen(process.argv[process.argv.indexOf('--listen') + 1]);\ncreateServer(() => {}).listen(0, '0.0.0.0');",
  );
  f.pack();
  f.run([], 1, 'Application opens a TCP listener');
});

test('rejects malformed manifest', (t) => {
  const f = fixture(t);

  f.entries[0].data = '[]';
  f.pack();
  f.run(['--archive-only'], 1, 'Manifest must be a JSON object');
});

test('accepts the network and launcher-only capabilities the applications declare', (t) => {
  const f = fixture(t);
  const manifest = JSON.parse(f.entries[0].data);

  manifest.permissions = { paths: [], network: ['smtp', 'sync'], packages: ['msmtp', '7zip'] };
  manifest.provides = [
    { capability: 'mail-events', version: 1, endpoint: '/internal/events' },
    { capability: 'cache', version: 1, endpoint: '/internal/cache' },
    { capability: 'trash', version: 1, endpoint: '/internal/trash' },
    { capability: 'search', version: 1, endpoint: '/api/launcher/search' },
  ];
  f.entries[0].data = JSON.stringify(manifest);
  f.pack();
  f.run(['--archive-only']);
});

test('rejects unknown networks and endpoints on the wrong side of /internal/', (t) => {
  for (const [change, message] of [
    [
      { permissions: { network: ['ftp'] } },
      "permissions.network may only contain 'smtp' and 'sync'",
    ],
    [
      { permissions: { packages: ['Bad Name'] } },
      'permissions.packages must contain package names',
    ],
    [
      { provides: [{ capability: 'trash', version: 1, endpoint: '/api/trash' }] },
      'The trash endpoint must be under /internal/',
    ],
    [
      { provides: [{ capability: 'search', version: 1, endpoint: '/internal/search' }] },
      'Capability endpoints must be public absolute paths',
    ],
  ]) {
    const f = fixture(t);
    f.entries[0].data = JSON.stringify({ ...JSON.parse(f.entries[0].data), ...change });
    f.pack();
    f.run(['--archive-only'], 1, message);
  }
});

test('the smoke test gives the application the environment it needs on the NAS', async (t) => {
  const f = fixture(t);
  const [shebang, ...body] = f.entries[1].data.split('\n');

  f.entries[1].data = [
    shebang,
    "if (process.env.NAS_SAMPLE !== 'yes') process.exit(3);",
    ...body,
  ].join('\n');
  f.pack();
  writeFileSync(join(f.root, 'nas-app.json'), f.entries[0].data);
  const args = [f.archive, '--timeout', '2'];
  await smokeNas(args, f.root, { env: { NAS_SAMPLE: 'yes' } });
  await assert.rejects(smokeNas(args, f.root));
  // Options alone keep the release archive and the expectations read from the manifest.
  mkdirSync(join(f.root, 'release-assets'));
  copyFileSync(f.archive, join(f.root, 'release-assets', basename(f.archive)));
  copyFileSync(
    `${f.archive}.sha256`,
    join(f.root, 'release-assets', `${basename(f.archive)}.sha256`),
  );
  await smokeNas(['--timeout', '2'], f.root, { env: { NAS_SAMPLE: 'yes' } });
  await assert.rejects(
    smokeNas(['--expected-version', '9.9.9', '--archive-only'], f.root),
    /does not match --expected-version/,
  );
});

test('one command runs each shared tool from the application root', (t) => {
  const f = fixture(t);
  const cli = fileURLToPath(new URL('../../../scripts/cli.mjs', import.meta.url));
  const run = (...args) =>
    spawnSync(process.execPath, [cli, ...args], { cwd: f.root, encoding: 'utf8' });

  writeFileSync(join(f.root, 'CHANGELOG.txt'), '# Changelog\n\n## [1.2.3]\n\n- Feature.\n');
  assert.equal(run('changelog', '1.2.3').stdout, '## [1.2.3]\n\n- Feature.\n');
  f.pack();
  const checked = run('test-package', f.archive, '--archive-only');
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /PASS package: sample 1\.2\.3/);
  const unknown = run('deploy');
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /usage: nas-base-app <format-sfc \| lock/);
});

test('rejects corrupted tar header even with matching archive checksum', (t) => {
  const f = fixture(t);
  const data = tar(f.entries);

  data[20] ^= 1;
  writeFileSync(f.archive, gzipSync(data));
  f.checksum();
  f.run(['--archive-only'], 1, 'tar header checksum');
});

test('rejects duplicate entries and writes below links', (t) => {
  const f = fixture(t);

  f.pack([...f.entries, f.entries[0]]);
  f.run(['--archive-only'], 1, 'Duplicate archive path');
  f.pack([
    ...f.entries,
    { name: 'link', type: '2', target: '.' },
    { name: 'link/file', data: 'bad' },
  ]);
  f.run(['--archive-only'], 1, 'Non-directory archive parent');
});

test('allows safe symlinks and hardlinks', (t) => {
  const f = fixture(t);

  f.pack([
    ...f.entries,
    { name: 'logo.svg', type: '2', target: 'icon.svg' },
    { name: 'hard.svg', type: '1', target: 'icon.svg' },
  ]);
  f.run(['--archive-only']);
});

test('rejects escaping links including chained traversal', (t) => {
  const f = fixture(t);

  f.pack([...f.entries, { name: 'bad', type: '2', target: '../escaped' }]);
  f.run(['--archive-only'], 1, 'link escapes');
  f.pack([
    ...f.entries,
    { name: 'a', type: '2', target: '.' },
    { name: 'b', type: '2', target: 'a/../escaped' },
  ]);
  f.run(['--archive-only'], 1, 'link escapes');

  assert.equal(existsSync(join(f.root, 'escaped')), false);
});

test('reads GNU tar PAX archives with long Unicode paths', (t) => {
  const f = fixture(t);
  const staging = join(f.root, 'staging');

  mkdirSync(staging);

  for (const entry of f.entries) {
    const name = join(staging, entry.name);

    mkdirSync(join(name, '..'), { recursive: true });
    writeFileSync(name, entry.data, { mode: entry.mode ?? 0o644 });
  }

  writeFileSync(join(staging, `immagine-${'è'.repeat(65)}.txt`), 'long path');
  execFileSync('tar', [
    '--create',
    '--gzip',
    '--format=posix',
    '--file',
    f.archive,
    '--directory',
    staging,
    '.',
  ]);
  f.checksum();
  f.run(['--archive-only']);
});

test('enforces archive memory limit', (t) => {
  const f = fixture(t);

  f.pack([...f.entries, { name: 'large', data: Buffer.alloc(2 * 1024 * 1024) }]);
  f.run(['--archive-only', '--max-unpacked-mib', '1'], 1, 'FAIL:');
});

test('validates PAX path overrides before extraction', (t) => {
  const f = fixture(t);
  const record = 'path=../escaped\n';
  let length = Buffer.byteLength(record) + 2;

  while (Buffer.byteLength(`${length} ${record}`) !== length) {
    length = Buffer.byteLength(`${length} ${record}`);
  }

  f.pack([
    ...f.entries,
    { name: 'PaxHeader', type: 'x', data: `${length} ${record}` },
    { name: 'apparently-safe', data: 'bad' },
  ]);
  f.run(['--archive-only'], 1, 'Unsafe package path');
});

test('rejects truncated tar archives with matching checksum', (t) => {
  const f = fixture(t);

  writeFileSync(f.archive, gzipSync(tar(f.entries).subarray(0, 512)));
  f.checksum();
  f.run(['--archive-only'], 1, 'truncated tar');
});
