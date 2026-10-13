import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, isAbsolute, join } from 'node:path';

const SYSTEM_DIRECTORIES = [
  '/usr/local/sbin',
  '/usr/local/bin',
  '/usr/sbin',
  '/usr/bin',
  '/sbin',
  '/bin',
];

let privateGroupIds;
function privateGroups() {
  if (privateGroupIds) return privateGroupIds;
  const accounts = readFileSync('/etc/passwd', 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split(':'));
  const allowed = new Set(
    accounts
      .filter((account) => Number(account[2]) === 0 || Number(account[2]) === process.getuid?.())
      .map((account) => account[0]),
  );
  privateGroupIds = new Set(
    readFileSync('/etc/group', 'utf8')
      .trim()
      .split('\n')
      .map((line) => line.split(':'))
      .filter(
        (group) =>
          group[3]
            .split(',')
            .filter(Boolean)
            .every((name) => allowed.has(name)) &&
          accounts
            .filter((account) => account[3] === group[2])
            .every((account) => allowed.has(account[0])),
      )
      .map((group) => Number(group[2])),
  );
  return privateGroupIds;
}

function writableByOthers(metadata) {
  return (
    (metadata.mode & 0o002) !== 0 ||
    ((metadata.mode & 0o020) !== 0 && !privateGroups().has(metadata.gid))
  );
}

function trustedDirectory(path, ancestor = false) {
  const metadata = statSync(path);
  const owner = process.getuid?.();
  const writable = writableByOthers(metadata);
  const protectedByStickyBit = ancestor && (metadata.mode & 0o1000) !== 0;
  if (
    !metadata.isDirectory() ||
    (writable && !protectedByStickyBit) ||
    (metadata.uid !== 0 && metadata.uid !== owner)
  ) {
    throw new Error(`Tool directory is writable by an untrusted user: ${path}`);
  }
}

function trustedParents(path) {
  let parent = dirname(path);
  while (parent !== dirname(parent)) {
    trustedDirectory(parent, true);
    parent = dirname(parent);
  }
  trustedDirectory(parent);
}

function trusted(path, directory = false) {
  if (!isAbsolute(path)) throw new Error(`Tool paths must be absolute: ${path}`);
  const metadata = statSync(realpathSync(path));
  const owner = process.getuid?.();
  if (
    (directory ? !metadata.isDirectory() : !metadata.isFile()) ||
    writableByOthers(metadata) ||
    (metadata.uid !== 0 && metadata.uid !== owner)
  )
    throw new Error(`Tool path is writable by an untrusted user: ${path}`);
  trustedParents(path);
  trustedParents(realpathSync(path));
  if (!directory && (metadata.mode & 0o111) === 0)
    throw new Error(`Tool is not executable: ${path}`);
  return path;
}

function directories(env) {
  return [
    ...new Set([
      dirname(process.execPath),
      join(env.CARGO_HOME ?? join(homedir(), '.cargo'), 'bin'),
      ...SYSTEM_DIRECTORIES,
    ]),
  ]
    .filter(existsSync)
    .map((path) => trusted(path, true));
}

/** System tools and the current user's Node/Rust installations, never the project's PATH. */
export function toolEnvironment(env = process.env) {
  const paths = directories(env);
  const result = { ...env, PATH: paths.join(delimiter) };
  for (const name of ['RUSTC_WRAPPER', 'RUSTC_WORKSPACE_WRAPPER']) {
    const wrapper = result[name];
    if (!wrapper) continue;
    const path = isAbsolute(wrapper)
      ? wrapper
      : paths.map((base) => join(base, wrapper)).find(existsSync);
    if (!path) throw new Error(`Compiler wrapper not found: ${wrapper}`);
    result[name] = trusted(path);
  }
  return result;
}

export function toolPath(name, env = process.env) {
  const defaults = {
    git: '/usr/bin/git',
    podman: '/usr/bin/podman',
    npm: join(dirname(process.execPath), 'npm'),
    cargo: join(env.CARGO_HOME ?? join(homedir(), '.cargo'), 'bin/cargo'),
  };
  if (!Object.hasOwn(defaults, name)) throw new Error(`Unsupported tool: ${name}`);
  const override = env[`NAS_${name.toUpperCase()}_EXECUTABLE`];
  const path = override ?? (existsSync(defaults[name]) ? defaults[name] : `/usr/bin/${name}`);
  trusted(dirname(path), true);
  return trusted(path);
}

function optionsFor(options) {
  return { ...options, env: toolEnvironment({ ...process.env, ...options.env }) };
}

export function execToolSync(name, args, options = {}) {
  const wanted = optionsFor(options);
  return execFileSync(toolPath(name, wanted.env), args, wanted);
}

export function spawnTool(name, args, options = {}) {
  const wanted = optionsFor(options);
  return spawn(toolPath(name, wanted.env), args, wanted);
}

export function spawnToolSync(name, args, options = {}) {
  const wanted = optionsFor(options);
  return spawnSync(toolPath(name, wanted.env), args, wanted);
}
