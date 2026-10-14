# @valeriogc/nas-base-app

Vue 3 library for the shared parts of the NAS applications: layouts, SCSS themes, components,
helpers, the launcher bridge using the `nas: 1` iframe protocol, and Node tools for building,
packaging and releasing apps. The ten projects in `external-apps` use this library.

The library has no Rust backend. Rust builds and coverage belong to the consuming applications.
Sonar scanning is configured directly in each project's `package.json` and `sonar.properties`.

## Installation

The package is published on GitHub Packages. Add this scope to the application's `.npmrc`:

```ini
@valeriogc:registry=https://npm.pkg.github.com
```

Declare the published version in `package.json`:

```json
"dependencies": { "@valeriogc/nas-base-app": "0.1.5" }
```

Local installs need a classic token with `read:packages` in your own `~/.npmrc`
(`//npm.pkg.github.com/:_authToken=...`). App workflows use their `GITHUB_TOKEN`; grant their
repositories Read access under the package's **Manage Actions access** settings.

In the app's local `pnpm-workspace.yaml`, set `'@valeriogc/nas-base-app': false` under
`allowBuilds`. The library's `postinstall` synchronizes its own npm lockfile and does nothing
when installed as a dependency.

To try a library change before publishing, run `pnpm run build` here, temporarily use
`"file:../../nas-base-app"` in the app, and run `pnpm install --force` there. Restore the
published dependency before committing the app.

Node >= 24.12 and Vue >= 3.5, < 4 are required. The app bundles the library into its frontend;
the NAS does not need to install this npm package at runtime.

## SCSS and shared styles

Import the complete stylesheet once from `src/main.ts`:

```ts
import '@valeriogc/nas-base-app/styles.scss';
```

Or use it in the app's `src/styles/main.scss`:

```scss
@use '@valeriogc/nas-base-app/styles.scss';
```

The entry includes the theme, reset, layout, base app styles, controls and scrollbar styles.
All public style entries are SCSS; the app's bundler produces the browser CSS.

The theme provides light and dark palettes, `--nas-*` tokens and aliases used by existing app
styles, including `--surface`, `--text`, `--border`, `--muted` and status colors. Launcher
context overrides the tokens through the composable; standalone apps use the defaults.

Classes can also be used without `NasAppLayout`:

```html
<div class="app_surface">
  <aside class="app_sidebar">
    <nav class="category_navigation" aria-label="Categories">
      <button class="category_button active" aria-pressed="true">Backup</button>
    </nav>
  </aside>
  <main class="app_content">
    <header class="page_header"><h1>Backup</h1></header>
    <section class="app_panel page_panel">
      <label class="app_field">Name <input type="text" /></label>
      <div class="app_toolbar">
        <button class="app_button app_button--primary">Save</button>
        <button class="app_button">Cancel</button>
      </div>
    </section>
  </main>
</div>
```

| Classes                                                                      | Purpose                                       |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| `app_surface`, `app_sidebar`, `app_content`                                  | Desktop and mobile layout                     |
| `category_navigation`, `category_button`, `category_icon`                    | Categories and their `active` state           |
| `app_button`, `app_button--primary`, `app_button--icon`, `app_button--small` | Buttons and variants                          |
| `app_icon`                                                                   | Image icons with a theme-dependent filter     |
| `app_panel`, `surface_card`, `page_panel`, `card_heading`                    | Panels and cards                              |
| `app_field`, `field`                                                         | Inputs, selects and textareas                 |
| `app_toolbar`, `app_scroll`, `page_header`                                   | Toolbars, scrolling content and page headings |
| `app_error`, `muted`, `sr_only`, `visually_hidden`                           | Messages and supporting text                  |

Use `app_panel`, `surface_card`, `app_toolbar`, `app_scroll` and `app_error` inside
`app_surface`. The classes define appearance; apps own event handling and state. The complete
entry includes a page reset and should be loaded once per app or iframe.

For variables, mixins and placeholders without emitted global rules:

```scss
@use '@valeriogc/nas-base-app/styles/global.scss' as *;

.custom_toolbar {
  @include flex_between(12px);
}
```

`global.scss` emits no CSS and can be injected into SFC styles through Vite's Sass configuration.
Individual partials are available under `@valeriogc/nas-base-app/styles/`, for example
`@use '@valeriogc/nas-base-app/styles/_nas-theme.scss';`. Apps may import only the partials they
need to retain their own layout and visual design.

## Layout and categories

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { NasAppLayout, useNasLauncherContext, type NasCategory } from '@valeriogc/nas-base-app';
import '@valeriogc/nas-base-app/styles.scss';
import scheduledIcon from './assets/scheduled.svg';
import liveIcon from './assets/live.svg';

type Section = 'scheduled' | 'live';
const section = ref<Section>('scheduled');
const { locale, shell } = useNasLauncherContext();
const labels = computed(() =>
  locale.value === 'it'
    ? { scheduled: 'Pianificati', live: 'Tempo reale', navigation: 'Categorie backup' }
    : { scheduled: 'Scheduled', live: 'Real time', navigation: 'Backup categories' },
);
const categories = computed<NasCategory<Section>[]>(() => [
  { value: 'scheduled', label: labels.value.scheduled, icon: scheduledIcon },
  { value: 'live', label: labels.value.live, icon: liveIcon },
]);

function openExplorer() {
  shell.openApp('nas-file-manager', '?directory=/');
}
</script>

<template>
  <NasAppLayout v-model="section" :categories="categories" :navigation-label="labels.navigation">
    <template #header="{ category }">
      <h1>{{ category?.label }}</h1>
    </template>
    <section v-if="section === 'scheduled'">Scheduled backups</section>
    <section v-else>Live activity</section>
  </NasAppLayout>
</template>
```

Categories accept `{ value, label, icon?, disabled?, testid? }`. `testid` becomes the button's
`data-testid` for app browser tests. Selection is controlled by `v-model`; the component does
not select a category automatically or modify the list. An app can handle `@update:model-value`
with `:model-value`, for example to confirm leaving a form with unsaved changes.

| Slot           | Parameters           | Purpose                                |
| -------------- | -------------------- | -------------------------------------- |
| default        | `category`, `value`  | Main content                           |
| header         | `category`           | Main heading and actions               |
| sidebar-header | `category`           | Sidebar logo or heading                |
| sidebar-footer | `category`           | Additional actions                     |
| icon           | `category`, `active` | Custom icon, including a Vue component |

The layout uses a vertical sidebar on desktop and horizontally scrolling categories below
760px. Buttons support keyboard navigation, expose `aria-pressed` and respect `disabled`.
Apps supply labels and translations.

`contained` limits the app to the iframe height and makes its content scrollable. `sidebar-attrs`
and `content-attrs` add attributes to the internal elements. `--nas-app-content-max-width`
limits content width. Providing `close-label` enables a button that emits `close`;
`close-disabled` blocks it during operations such as saving.

The current launcher does not handle a `close` message. The component's event lets the app
handle a local close request or prepare a future integration; it does not close a launcher window.

## Shared components and helpers

- `NasIcon`: accepts an SVG asset URL in `svg` and renders it as a mask using `currentColor`.
- `NasPageHeader`: `title`, optional `overview` and `subtitle`, and an `actions` slot.
- `NasModal`: a native dialog with `label`, optional `dismissible` and a content slot. It emits
  `close` for Escape or backdrop clicks. Use `v-if`; the app decides when to unmount it.
- `NasNumberStepper`: integer `v-model`, `id`, `min`, `max`, optional `label`,
  `increaseLabel`, `decreaseLabel`, `disabled` and optional `testid`. Rejects empty,
  fractional or out-of-range input.
- `NasPagination`: one-based page `v-model`, `totalPages`, translated labels, `pageLabel(page)`,
  optional `disabled` and `testid`, with compact page ranges and ellipses.
- `NasConfirmDialog`: `title`, `message`, `cancelLabel`, `confirmLabel`, optional
  `confirmDisabled`, `busy`, `testid`, `cancelTestid` and `confirmTestid`, plus a slot below the
  actions. Emits `cancel` and `confirm`, with autofocus on Cancel. Use `v-if`; `busy` blocks both
  buttons and Escape, while `confirmDisabled` blocks only confirmation.
- `NasEmptyState`: `title`, optional `description` and SVG asset, and `icon` and `actions` slots.
  The app decides when to show it and owns loading state.
- `NasLoading`: announces `label` with `aria-live="polite"` and respects reduced motion.
- `NasSwitch`: boolean `v-model`, `label`, optional `disabled` and `testid`, using a native input.
- `vNasModal`: opens `<dialog v-if="..." v-nas-modal>` with `showModal()` and closes it on
  unmount. The app handles cancellation, buttons, confirmations and dialog state.
- `guardFrame()`: applies shared iframe behavior restrictions at the app entry point.
- `applyNasPalette(palette, root?)`: validates and applies launcher colors without requiring
  the composable.
- `createNasI18n(messages, initial?)`: provides `locale`, `setLocale` and `useI18n` with `t`.
  Catalogs belong to the app; `setLocale` also updates the page's `lang` attribute.
- `storedDocument(name, { parse, url?, legacyKey? })`: loads JSON from `api/documents/<name>`
  with `load()` and saves changes after a short delay. Pages in the same browser synchronize
  through `BroadcastChannel`; other browsers reload when visible again.
- `formatBytes(bytes, locale)` and `share(part, whole)`: readable sizes and percentages up to 100.
- `randomUuid()`: cryptographic UUID v4, including contexts without `crypto.randomUUID`.
- `describeSchedule`, `scheduleKind`, `weekdayName`, `monthName`: describe `NasSchedule`
  values (`daily`, `weekly`, `monthly`, `yearly`) using the app's catalog templates.
- `minuteOf`, `offRanges`, `offAt`, `powerWeekdays`: convert times and identify periods when
  the NAS power schedule leaves it switched off.

Import SVGs in the component that uses them:

```vue
<script setup lang="ts">
import { NasIcon } from '@valeriogc/nas-base-app';
import refreshIcon from './assets/refresh.svg';
</script>

<template>
  <button type="button"><NasIcon :svg="refreshIcon" /> Refresh</button>
</template>
```

`svg` is the asset URL returned by a normal Vite import. No SVG Vue plugin, `?raw` import or
library-owned icon registry is required. `NasIcon` is decorative; put an accessible label on
its containing control.

Components use the shared SCSS entry. Their classes are also available directly in markup,
including `app_loading`, `loading_spinner`, `app_switch`, `app_switch_track`, `app_switch_label`,
`app_icon_mask`, `tone_text_*`, `app_modal`, `nas_page_header`, `number_stepper`, `number_steps`,
`step_arrow`, `nas_pagination`, `nas_pagination_pages`, `nas_pagination_page`, `nas_pagination_gap`,
`nas_confirm_dialog`, `nas_confirm_message`, `nas_confirm_actions`, `nas_empty_state`,
`nas_empty_icon` and `nas_empty_actions`.

### Pagination

The app owns its data, loading state and total page count. `NasPagination` emits
`update:modelValue` when a different page is selected; it does not fetch data.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { NasPagination } from '@valeriogc/nas-base-app';

const page = ref(1);
const totalPages = ref(12);
const labels = {
  navigation: 'Result pages',
  previous: 'Previous',
  next: 'Next',
  page: (value: number) => `Page ${value}`,
};
</script>

<template>
  <NasPagination
    v-model="page"
    :total-pages="totalPages"
    :label="labels.navigation"
    :previous-label="labels.previous"
    :next-label="labels.next"
    :page-label="labels.page"
  />
</template>
```

Supply labels from the app's i18n catalog. The active page uses `aria-current="page"` and all
buttons are keyboard accessible. `disabled` blocks navigation during loading. With zero pages,
page numbers are hidden and actions are disabled. Invalid totals are treated as zero.

If the total decreases, the displayed page is clamped without changing the model. Resetting
selection after filtering or a new search belongs to the app. First and last pages remain
reachable with at most seven items in the page list. The layout wraps in narrow containers;
`--nas-pagination-gap` and `--nas-pagination-page-size` control spacing and minimum page width.

## Launcher context

Call `useNasLauncherContext()` once in the root component. It registers its listener before
sending `ready`, updates theme, accent, palette and locale for each `context` message, and returns:

- `shell`: the launcher bridge.
- `locale`, `theme`, `active`, `context`: readonly refs. `active` becomes true after valid context.

Standalone mode reads `?lang=it|en&theme=light|dark`; defaults are Italian and the light theme.
The `locale` and `theme` options change the defaults. `onLocaleChange` connects the app's i18n
without imposing a catalog; supported locales are `it` and `en`.

The composable applies `data-theme`, `data-nas-shell`, `--accent` and the `--nas-background`,
`--nas-foreground`, `--nas-surface`, `--nas-sunken`, `--nas-hover`, `--nas-border`, `--nas-muted`
tokens to `document.documentElement`. Missing or invalid colors remove their overrides.
On unmount, previous attributes and token values are restored. Pass `root` to use another
element, or `root: null` to disable DOM changes. Use one instance per root element.

Shared styles provide light and dark defaults and an app page reset. Layout tokens include
`--nas-app-sidebar-width`, `--nas-app-content-padding`, `--nas-app-mobile-padding`,
`--nas-app-sidebar-padding`, `--nas-app-nav-padding`, `--nas-app-nav-gap`, `--nas-app-icon-gap`,
`--nas-app-icon-size` and `--nas-app-radius`.

## Launcher bridge

`createNasShell()` also works without the composable. Each instance owns its listeners and
pending requests; call `dispose()` when finished. Importing the package in SSR does not access
`window` or `document`.

| Method                                      | Behavior                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `listen(callback)`                          | Receives context and described notifications; returns an unsubscribe function        |
| `ready()`                                   | Requests launcher context                                                            |
| `openApp(id, location?)`                    | Opens another app; `location` is a query starting with `?`, up to 2048 characters    |
| `openHttps()`                               | Requests that the launcher reload over HTTPS                                         |
| `notify(title, message?, tone?)`            | Sends a notification with `info`, `success`, `warning` or `error` tone               |
| `describeNotifications(list)`               | Requests translated labels received by `listen` as `described`                       |
| `pickFiles(options?)`                       | Requests files and returns `{ files, cancelled }`                                    |
| `pickFolder(directory?, timeoutMs?)`        | Requests a folder                                                                    |
| `requestFolderShortcut(path, name)`         | Creates a shortcut; the launcher permits this only for nas-file-manager              |
| `requestNetworkDisks()`                     | Reads network disks from the installed provider                                      |
| `requestPowerSchedule()`                    | Reads the power schedule                                                             |
| `request(type, payload?, options?)`         | Correlates the `type-result` reply and returns `{ success, data?, error?, taskId? }` |
| `sendPickedFiles(token, files, cancelled?)` | Answers the picker as a provider                                                     |
| `dispose()`                                 | Removes listeners, clears timers and rejects pending requests                        |

Methods without replies return `false` outside an iframe or after disposal. `true` means the
message was sent, not that the launcher completed it. `request()` leaves `success: false`
and domain data handling to the app. Other methods with replies return promises and reject
with `NasShellError`: `unavailable`, `timeout`, `disposed`, `invalid-response` or `launcher-error`.

The default request timeout is 10 seconds, configurable with `createNasShell({ timeoutMs })`.
File pickers use a separate five-minute default, configurable with `pickFiles({ timeoutMs })`.
Network disk requests wait at least 45 seconds because the provider may need to start.
`FilePickerOptions` accepts `multiple`, `folder`, `extensions` with a leading dot, and `directory`.

Messages use `nas: 1`, without wildcard origins. Only validated messages from `window.parent`
on the app's origin are accepted. Opening apps and file picking go through the launcher;
a generic bus for direct inter-app messages would require an additional contract.

## Development and package checks

```bash
pnpm run check
pnpm run nas:package
pnpm run nas:test
```

`check` runs formatting, lint, unit and component tests, TypeScript checks and the build.
`nas:package` runs `node scripts/release/release-library.mjs pack`, producing an npm archive and
its SHA256 file. `nas:test` verifies the archive, compiles the SCSS entries and an isolated Vue
consumer, and checks TypeScript, SSR imports, Node tools and Vite plugins. It requires `tar`
and does not test integration with a running NAS.

`test:coverage` enforces 80% coverage for each source file. Sonar uses the frontend and Node LCOV
reports configured in `sonar.properties`; see [DEVELOPMENT.md](DEVELOPMENT.md).

## App tools

The package installs `nas-base-app`, used from the app root in npm scripts and workflows:

| Command                                    | Purpose                                                 |
| ------------------------------------------ | ------------------------------------------------------- |
| `format-sfc [--check]`                     | SFC script/style spacing and formatting                 |
| `lock --sync`, `lock --check`              | Synchronizes or checks `package-lock.json`              |
| `backend-dev`                              | Runs Cargo with the development socket                  |
| `package`                                  | Creates a NAS release archive and prunes older releases |
| `test-package [archive] [options]`         | Standalone NAS package checker                          |
| `smoke [options]`                          | Checks the current app release archive                  |
| `release-check [tag]`, `changelog version` | Release metadata and changelog extraction               |
| `release-test`, `release-merge`            | Release checks and local merge/tag workflow             |

Vite configurations import `frontendBoundary`, `stripTestIds`, `stripTestIdsNodeTransform` and
`nasPurgeSafelist` from `@valeriogc/nas-base-app/vite`. The safelist includes library classes
and elements absent from the app's sources. Node helpers are separately available from
`@valeriogc/nas-base-app/scripts`; see [scripts/README.md](scripts/README.md).

Sonar and Rust coverage are direct commands in each app's `package.json`, outside this CLI.

## Releases

```bash
pnpm run release:check
pnpm run release:test
pnpm run release:merge
```

`release:check` checks the tag, package version and changelog. `release:test` checks, tests,
builds, measures coverage, packs and verifies the library. `release:merge` updates versions and
the changelog, runs the checks, commits, merges to the target branch, then pushes the branch and tag.

Options include `-- --type=minor|major`, `-- --branch=main` and `-- --dry-run`. A `vX.Y.Z` tag
starts `.github/workflows/publish.yml`, which repeats the release checks and publishes to
GitHub Packages.

See [COMPONENTS.md](COMPONENTS.md) for shared component origins and
[DEVELOPMENT.md](DEVELOPMENT.md) for project structure and conventions.
