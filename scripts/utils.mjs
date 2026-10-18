import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function isMain(url) {
  return Boolean(process.argv[1]) && url === pathToFileURL(process.argv[1]).href;
}

export async function runCli(url, action, prefix = '') {
  if (!isMain(url)) return;
  try {
    await action();
  } catch (error) {
    console.error(`${prefix}${error.message}`);
    process.exitCode = 1;
  }
}

export function optionValue(args, name) {
  return args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function cargoExecutable(env = {}) {
  return (
    env.NAS_CARGO_EXECUTABLE ??
    process.env.NAS_CARGO_EXECUTABLE ??
    join(env.CARGO_HOME ?? process.env.CARGO_HOME ?? join(homedir(), '.cargo'), 'bin/cargo')
  );
}

export function runCargo(args, options) {
  return execFileSync(cargoExecutable(), args, options);
}

export function runNpm(args, options) {
  return execFileSync(
    process.env.NAS_NPM_EXECUTABLE ?? join(dirname(process.execPath), 'npm'),
    args,
    options,
  );
}

export function runGit(args, options) {
  return execFileSync(process.env.NAS_GIT_EXECUTABLE ?? '/usr/bin/git', args, {
    ...options,
    encoding: 'utf8',
  }).trim();
}

export function writeChecksum(file) {
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
  writeFileSync(`${file}.sha256`, `${digest}  ${basename(file)}\n`);
}
