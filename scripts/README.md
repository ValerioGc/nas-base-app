# Shared NAS app tools

Apps invoke `nas-base-app`, installed with the library, from their npm scripts and workflows.
The app owns its backend, manifest and configuration. Commands run from the app root and use
that directory as their working project.

## Organization

| Directory   | Responsibility                                                                 |
| ----------- | ------------------------------------------------------------------------------ |
| `dev/`      | SFC formatting and npm lockfile synchronization                                |
| `build/`    | Vite plugins and the purge safelist, compiled into `dist/vite`                 |
| `axium/`    | Backend paths and startup, NAS packaging and runtime checks                    |
| `pipeline/` | Release checks, changelog extraction, asset pruning and library package checks |
| `release/`  | Local version changes, merge/tag workflow and library releases                 |

The root contains the CLI, the importable Node entry point, `utils.mjs` and this guide.
`utils.mjs` shares CLI entry checks and errors, JSON I/O, tool executable selection and SHA256
sidecar creation. The standalone package checker keeps its own entry point so it can still be
copied and run as a single file. Library-specific
`scripts/release/release-library.mjs` and `scripts/pipeline/test-package.mjs` are not published.

## Commands

| App script                             | Command                                                 | Module                                              |
| -------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `format`, `format:check`, `format:sfc` | `nas-base-app format-sfc [--check]`                     | `dev/format-sfc-spacing.mjs`                        |
| `lint`, `postinstall`                  | `nas-base-app lock --check`, `--sync`                   | `dev/npm-lock.mjs`                                  |
| `backend:dev`                          | `nas-base-app backend-dev`                              | `axium/backend-dev.mjs`                             |
| `nas:package`                          | `nas-base-app package`, after frontend and Cargo builds | `axium/package-nas.mjs`                             |
| `nas:test`                             | `nas-base-app smoke [--env K=V]`                        | `axium/smoke-nas.mjs`, `axium/test-nas-package.mjs` |
| `release:check`                        | `nas-base-app release-check [tag]`                      | `pipeline/verify_release.mjs`                       |
| `release:test`                         | `nas-base-app release-test`                             | `pipeline/prepare_release.mjs`                      |
| `release:merge`                        | `nas-base-app release-merge`                            | `release/merge_release.mjs`                         |
| Workflow release notes                 | `nas-base-app changelog <version>`                      | `pipeline/extract-changelog.cjs`                    |

`package` reads the app's `nas-app.json`, `package.json` and Cargo metadata and writes to
`release-assets/`. `pipeline/prune-assets.mjs` keeps the packaged version and the latest
preceding version with a matching package prefix. Other versioned files, including artifacts
under old package names, are removed; unversioned files and directories remain.

`smoke` uses the current release archive. Options without an explicit archive, such as `--env`
and `--timeout`, extend its defaults. `test-package --help` describes the standalone checker;
it uses only Node built-in modules and can run from an unrelated directory.

Backend tools support an Axum workspace with `backend/axum/Cargo.toml` or Picture's direct
`backend/Cargo.toml` crate. The checker recognizes `smtp` and `sync` networks and launcher-only
capabilities under `/internal/`: `mail-events`, `cache` and `trash`.

## Node imports

`@valeriogc/nas-base-app/scripts` is separate from the browser entry. Importing it does not
start processes, perform releases or read app manifests:

```js
import { checkLock, formatSfc, smokeNas, verifyRelease } from '@valeriogc/nas-base-app/scripts';

const root = process.cwd();
checkLock(root);
await formatSfc({ root, checkOnly: true });
verifyRelease(undefined, root);
await smokeNas([], root, { env: { NAS_STORAGE_ROOT: '/tmp/storage' } });
```

`startBackend({ root, socket?, uiDir?, cargo?, env? })` returns the Cargo process; callers manage
its errors and shutdown. `testNasPackage(args, root?)` runs the checker without starting another
Node process. `smokeNas(args?, root?, { env? })` adds environment variables as `--env` options.
`extractChangelog(version, root?)`, `verifyRelease(tag?, root?)` and `prepareRelease(root?)`
also accept an explicit project root.

`mergeRelease({ type?, branch?, dryRun?, bump?, prepare? })` and `latestTag(root?)` use Git.
`dryRun` checks metadata and reports the proposed version without committing, merging or pushing.
The `bump` and `prepare` callbacks let the library use its own version updates and release checks.

## Tool executables

Existing scripts invoke tools directly through `node:child_process`. npm comes from the active
Node installation; Cargo uses `CARGO_HOME` or `~/.cargo`; Git defaults to `/usr/bin/git`.
`NAS_NPM_EXECUTABLE`, `NAS_CARGO_EXECUTABLE` and `NAS_GIT_EXECUTABLE` select alternate tools.

Apps import compiled Vite plugins from `@valeriogc/nas-base-app/vite`. These run in the build
configuration and do not enter the frontend bundle.
