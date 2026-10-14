# Developing nas-base-app

The projects in `../external-apps` depend on the published `@valeriogc/nas-base-app` package.
To try a change locally, build the library and temporarily use `file:../../nas-base-app` in the
app with `pnpm install --force`. Restore the published version before committing the app.
Do not run Git commands or create a `.git` directory. Publishing is triggered by the tag
created by `release:merge`.

## Structure

- `src/components/`: shared layout, headings, dialogs, icons, loading, switches, steppers,
  pagination, confirmation and empty states. Components contain no app domain logic.
- `src/directives/nativeModal.ts`: native dialog lifecycle.
- `src/services/`: iframe behavior, palette, launcher transport, payload validation, UUIDs,
  i18n, backend documents, formatting, schedules and power intervals.
- `src/composables/useNasLauncherContext.ts`: reactive launcher context, theme and cleanup.
- `src/types/`: public contracts exported from `src/index.ts`.
- `src/styles/main.scss`: full stylesheet exported as `@valeriogc/nas-base-app/styles.scss`.
- `src/styles/global.scss` and `partials/`: reusable Sass variables, mixins and placeholders.
- `src/styles/_nas-*.scss`: theme, layout, controls and component classes.
- `src/tests/`: unit, component and script tests, excluded from the npm package.
- `scripts/cli.mjs`: the `nas-base-app <command>` entry point.
- `scripts/index.mjs`: importable Node helpers, separate from the browser entry point.
- `scripts/dev/`: SFC formatting and npm lockfile synchronization.
- `scripts/build/`: Vite plugins and the purge safelist, compiled into `dist/vite`.
- `scripts/axium/`: backend paths and startup, NAS packaging, standalone checker and smoke test.
- `scripts/pipeline/`: release checks, changelog extraction, asset pruning and library package
  verification. `test-package.mjs` is excluded from the npm package.
- `scripts/release/`: local version updates, merge/tag workflow and library release orchestration.
  `release-library.mjs` is excluded from the npm package.

Vue is externalized by Vite. `vue-tsc` emits declarations into `dist/types`, without another
plugin for declaration generation. The package is ESM; apps explicitly import its SCSS.
The Vite build copies SCSS into `dist/styles`, preserving relative imports and excluding
non-style sources. The app compiles Sass, without dependencies on sibling projects.

`nas:package` calls `scripts/release/release-library.mjs pack` to create the npm archive and
SHA256 file. Shared app packaging creates a separate NAS archive containing the built frontend,
backend binary, manifest and launcher entry point.

## Conventions

Use strict TypeScript without `any`, type-only imports and `<script setup lang="ts">` SFCs.
Keep props in the component, public contracts in `src/types`, and two-way state in `defineModel`.
Apps supply UI text and translations. Import SVG assets in the consuming component and pass
them to `NasIcon` through `svg`; do not add icon-name registries or wrapper components.
Use SCSS for style sources and underscores in CSS class names.

Documentation, identifiers, test descriptions and runtime diagnostic messages are in English.
Keep useful code comments in Italian; explain contracts or non-obvious decisions and remove
comments that repeat the code. Do not use U+2014.

Shared styles are global and loaded through the explicit SCSS entry. Component-specific styles
can remain scoped and use the shared Sass helpers. When adding classes or elements to a component,
update `nasPurgeSafelist`. Avoid global side effects on import and clean up owned listeners and
timers when their lifecycle ends.

Tests should cover observable behavior: selection, events, accepted and rejected messages,
correlated replies, timeouts, cleanup and context updates. Component tests use semantic elements
or visible text.

## Dependencies and lockfiles

Keep the existing Vue/TypeScript/Node stack. Vue is the only runtime peer dependency.
Propose additional dependencies before adding them.

Use pnpm locally. `postinstall` synchronizes `package-lock.json` through
`scripts/dev/npm-lock.mjs`; CI uses `npm ci`. After `pnpm add`, `update` or `remove`, run
`pnpm run lock:npm`. Do not edit npm or Cargo lockfiles by hand. `pnpm-lock.yaml` remains local.
`lint` also checks that the npm lockfile matches dependencies and peer dependencies.

## Checks

```bash
pnpm run format
pnpm run check
pnpm run test:coverage
pnpm run nas:package
pnpm run nas:test
```

`release:test` runs the full library release checks, including metadata, coverage and package
verification. `format` runs Prettier, ESLint fixes and the SFC formatter. `format:check` leaves
sources unchanged. Vue files are handled by the SFC formatter because their required blank
lines are not preserved by Prettier alone.

The package check extracts an archive into a temporary consumer and uses the locally installed
Vue peer. It checks declarations, compiles SCSS and the Vue consumer, imports the package without
a DOM, and checks the Node helpers, Vite plugins and CLI. `styles/global.scss` must emit no CSS,
so component imports of Sass helpers do not duplicate global rules. These checks do not run a
NAS launcher.

## Local SonarQube

```bash
npm run podman:sonar:up
export SONAR_TOKEN='<project token>'
npm run test:sonar
```

Sonar commands are defined directly in `package.json`. The scanner reads `sonar.properties`
and defaults to the shared server at `http://127.0.0.1:9000`; `SONAR_HOST_URL` overrides it.
Keep the token in the environment, never in project configuration.

`test:coverage` generates `coverage/lcov.info` with Vitest for Vue and TypeScript, plus
`coverage/scripts.lcov.info` with Node's test runner for scripts. Sonar imports both and analyzes
`src/` and `scripts/`, excluding tests. The library has no Rust coverage or Clippy step.
Consuming apps define their own Rust coverage and Sonar commands in their `package.json`.

Coverage must reach 80% for each file: lines, functions and branches; Vitest also checks statements.
Node coverage explicitly includes `scripts/**`, including checker filenames containing `test`,
and excludes `src/tests/**`. `coverage/scripts-summary.json` records script percentages; missing
reports fail the coverage check. Script tests use simulated processes and temporary folders.
The package test builds an isolated copy of the source instead of requiring a previous build.

`podman:sonar:up` starts the existing `sonarqube` container, preserving its database, or creates
it with Compose when absent. `podman:sonar:logs` follows server logs; `podman:sonar:down` stops
the container without deleting its data. Release scripts do not read, validate or update
`sonar.properties`; project analysis configuration is managed separately.

## Integration scope

A new shared component must be used by at least two apps and contain no app-specific domain
rules. Launcher integration must be checked with apps installed on a real NAS. Remote window
closing and a generic inter-app message bus require launcher support.
