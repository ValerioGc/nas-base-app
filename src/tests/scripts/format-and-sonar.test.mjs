import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { toolFixture } from '../helpers/script-tools.mjs';

test('the SFC formatter CLI preserves CRLF, adds spacing between rules and reports check failures', (t) => {
  const f = toolFixture(t);
  symlinkSync(join(process.cwd(), 'node_modules'), join(f.root, 'node_modules'), 'dir');
  mkdirSync(join(f.root, 'src/nested'), { recursive: true });
  f.json('package.json', {});
  f.json('.prettierrc.json', { singleQuote: true, endOfLine: 'crlf' });
  writeFileSync(join(f.root, 'src/ignore.ts'), 'export {};\n');
  const file = join(f.root, 'src/nested/Consumer.vue');
  const source =
    '<script setup>\r\nconst value="test";\r\n</script>\r\n<template><p>{{value}}</p></template>\r\n<style lang="scss">\r\n.a {color: red;}\r\n.b {color: blue;}\r\n@if true { .c { color: red; } } @else { .c { color: blue; } }\r\n</style>\r\n';
  writeFileSync(file, source);
  assert.match(
    f.cli('format-sfc-spacing.mjs', ['--check'], {}, 1).stderr,
    /Components requiring formatting/,
  );
  assert.equal(readFileSync(file, 'utf8'), source);
  f.cli('format-sfc-spacing.mjs');
  const formatted = readFileSync(file, 'utf8');
  assert.ok(formatted.includes('}\r\n\r\n.b'));
  assert.equal(/(?<!\r)\n/.test(formatted), false);
  f.cli('format-sfc-spacing.mjs', ['--check']);
  assert.equal(readFileSync(file, 'utf8'), formatted);
});

test('Sonar CLI forwards an explicit host and reports failed or unstartable tools', (t) => {
  const f = toolFixture(t);
  mkdirSync(join(f.root, 'backend'));
  const cargo = f.install('cargo', "console.log('{}');");
  const podman = f.install('podman');
  f.cli('pipeline/sonar.mjs', ['--no-rust'], { SONAR_HOST_URL: 'https://sonar.example.invalid' });
  assert.ok(f.calls()[0].args.includes('SONAR_HOST_URL=https://sonar.example.invalid'));
  assert.match(f.cli('pipeline/sonar.mjs', ['--invalid'], {}, 1).stderr, /Unknown option/);
  writeFileSync(cargo, '#!/missing/nas-interpreter\n');
  assert.match(f.cli('pipeline/sonar.mjs', [], {}, 1).stderr, /ENOENT/);
  writeFileSync(podman, '#!/missing/nas-interpreter\n');
  assert.match(f.cli('pipeline/sonar.mjs', ['--no-rust'], {}, 1).stderr, /ENOENT/);
  f.install('podman', "process.kill(process.pid,'SIGTERM');");
  f.cli('pipeline/sonar.mjs', ['--no-rust'], {}, 1);
});
