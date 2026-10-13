import assert from 'node:assert/strict';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { compileString, NodePackageImporter } from 'sass';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const filename = `${manifest.name.replace(/^@/, '').replaceAll('/', '-')}-${manifest.version}.tgz`;
const archive = resolve('release-assets', filename);
const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
assert.equal(readFileSync(`${archive}.sha256`, 'utf8'), `${checksum}  ${filename}\n`);
const { stdout: listing } = await promisify(execFile)('tar', ['-tzf', archive]);
const entries = listing.trim().split('\n');
assert(entries.every((entry) => entry.startsWith('package/') && !entry.split('/').includes('..')));
assert(
  entries.every((entry) => !entry.includes('node_modules/') && !entry.startsWith('package/src/')),
);

const fixture = mkdtempSync(join(tmpdir(), 'nas-base-app-consumer-'));
try {
  const packageDirectory = join(fixture, 'node_modules', manifest.name);
  mkdirSync(packageDirectory, { recursive: true });
  await promisify(execFile)('tar', [
    '-xzf',
    archive,
    '--strip-components=1',
    '-C',
    packageDirectory,
  ]);
  const packedManifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  assert.equal(packedManifest.version, manifest.version);
  const styleExport = packedManifest.exports['./styles.scss'];
  const expected = [
    packedManifest.main,
    packedManifest.types,
    styleExport.default,
    styleExport.types,
  ];
  for (const entry of expected) {
    assert(
      readFileSync(join(packageDirectory, entry)).length > 0,
      `Missing package entry: ${entry}`,
    );
  }
  const styles = compileString(`@use "pkg:${manifest.name}/styles.scss";`, {
    importers: [new NodePackageImporter(fixture)],
  }).css;
  assert(styles.includes('.app_button--primary'), 'Missing shared button classes');
  assert(styles.includes('.app_surface'), 'Missing shared layout classes');
  assert(styles.includes('--nas-background'), 'Missing theme tokens');
  const helpers = compileString(`@use "pkg:${manifest.name}/styles/global.scss";`, {
    importers: [new NodePackageImporter(fixture)],
  }).css;
  assert.equal(helpers, '', 'The Sass helper entry must not emit styles');
  const vuePackage = dirname(fileURLToPath(import.meta.resolve('vue/package.json')));
  symlinkSync(vuePackage, join(fixture, 'node_modules/vue'), 'dir');
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(
    join(fixture, 'index.html'),
    '<div id="app"></div><script type="module" src="/main.ts"></script>',
  );
  writeFileSync(
    join(fixture, 'main.ts'),
    `import { createApp } from 'vue';
import App from './App.vue';
import '${manifest.name}/styles.scss';
createApp(App).mount('#app');
`,
  );
  writeFileSync(
    join(fixture, 'App.vue'),
    `<script setup lang="ts">
import { ref } from 'vue';
import { NasAppLayout, createNasShell, type NasCategory } from '${manifest.name}';
type Section = 'first' | 'second';
const selected = ref<Section>('first');
const categories: NasCategory<Section>[] = [{ value: 'first', label: 'First' }, { value: 'second', label: 'Second' }];
const shell = createNasShell({ view: null });
shell.dispose();
</script>
<template><NasAppLayout v-model="selected" :categories="categories" navigation-label="Sections"><template #default="{ value }"><section class="app_panel page_panel"><h1>{{ value }}</h1><button class="app_button app_button--primary">Save</button></section></template></NasAppLayout></template>
<style scoped lang="scss">
@use '${manifest.name}/styles/global.scss' as *;
.example { @include flex_center; }
</style>
`,
  );
  writeFileSync(
    join(fixture, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        skipLibCheck: true,
        lib: ['ES2022', 'DOM'],
        noEmit: true,
      },
      include: ['*.ts', '*.vue'],
    }),
  );
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/vue-tsc/bin/vue-tsc.js'),
      '--noEmit',
      '-p',
      join(fixture, 'tsconfig.json'),
    ],
    { stdio: 'inherit' },
  );
  await build({ root: fixture, configFile: false, plugins: [vue()], logLevel: 'warn' });
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { NasAppLayout, createNasShell } from ${JSON.stringify(manifest.name)};
if (!NasAppLayout || createNasShell().available) throw new Error('Invalid SSR exports');
const tools = await import(${JSON.stringify(`${manifest.name}/scripts`)});
const plugins = await import(${JSON.stringify(`${manifest.name}/vite`)});
if (typeof tools.packageNas !== 'function' || typeof plugins.stripTestIds !== 'function')
  throw new Error('Invalid Node tools');`,
    ],
    { cwd: fixture, stdio: 'inherit' },
  );
  // The command an application runs from its scripts answers from the extracted package.
  const cli = spawnSync(
    process.execPath,
    [join(packageDirectory, packedManifest.bin['nas-base-app']), 'unknown'],
    { cwd: fixture, encoding: 'utf8' },
  );
  assert.equal(cli.status, 2, cli.stderr);
  assert.match(cli.stderr, /usage: nas-base-app/);
  console.log(
    'Package verified: SHA256, SCSS entries and helpers, TypeScript, isolated Vue build, SSR import, Node tools and Vite plugins.',
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
