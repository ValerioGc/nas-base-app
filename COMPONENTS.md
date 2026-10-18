# Shared components and app boundaries

This comparison covers the ten apps in `external-apps`. A component belongs in the library
when at least two apps use it and it contains no app-specific domain rules.

## Components

| Component                 | Origin                                                            | Library contract                                                             |
| ------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `NasAppLayout`            | Backup, Cleanup and Mail `AppSidebar`                             | Categories with icons and `testid`; header, footer and content slots         |
| `NasPageHeader`           | Log `AppHeader` and Disk `PageHeader`                             | Title, overview, subtitle and actions slot                                   |
| `NasModal`                | Log details and Cleanup, Mail, Security and Monitor `CommonModal` | Native dialog with label and close request; apps own headings                |
| `vNasModal`               | Disk dialog directive                                             | `showModal()` on mount and `close()` on unmount                              |
| `NasConfirmDialog`        | Mail and Sync `ConfirmDialog`, Backup `DiscardRuleDialog`         | Title, message, action labels, test IDs, busy state and a slot below actions |
| `NasEmptyState`           | Backup `CommonList` and Mail empty folders                        | Title, description, icon or slot, and actions                                |
| `.nas_empty_framed`       | Cleanup and Sync empty lists                                      | Dashed frame and round `.nas_empty_badge`                                    |
| `NasNumberStepper`        | Monitor and Security `NumberStepper`                              | Integer with bounds, translated labels and app-supplied `testid`             |
| `NasIcon`                 | Mail, Log, Disk, Security and Monitor `AppIcon`                   | SVG URL imported by the consumer, without an icon registry                   |
| `NasLoading`, `NasSwitch` | Disk, Mail, Security and Monitor controls                         | Announced loading state and native switch                                    |
| `NasPagination`           | Available for app integration                                     | Current page, total page count and translated labels                         |

Apps retain their `CommonModal` wrappers where needed for headings, close buttons, footers and
sizes; `NasModal` supplies the dialog container. `NasNumberStepper` restores the current model
value after out-of-range input. Apps decide when to show, confirm or unmount dialogs.

## Shared helpers

| Area                             | Origin                                                 | Library API                                                 |
| -------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Launcher bridge and context      | App `nasShell.ts` modules and composables              | `createNasShell`, `useNasLauncherContext`                   |
| Iframe behavior                  | Shared `frameGuard.ts`                                 | `guardFrame`                                                |
| i18n runtime                     | Apps with the same catalog implementation              | `createNasI18n`                                             |
| Backend documents                | Explorer and Monitor `documents.ts`                    | `storedDocument`                                            |
| Sizes and percentages            | Cleanup and Sync `format.ts`                           | `formatBytes`, `share`                                      |
| Schedule descriptions            | Backup and Cleanup schedule helpers                    | `describeSchedule`, `scheduleKind`, weekday and month names |
| Power-off intervals              | Backup and Security power helpers                      | `offRanges`, `offAt`, `minuteOf`, `powerWeekdays`           |
| Themes and styling               | App SCSS themes, reset, layout, controls and scrollbar | Individually importable SCSS partials                       |
| Build, package and release tools | App Node tools and Vite plugins                        | `nas-base-app`, `/scripts` and `/vite`                      |

Sonar configuration and frontend/Rust coverage commands belong to each app's `package.json`
and `sonar.properties`. The library has no Rust backend and provides no Sonar or Rust coverage
script.

App-specific launcher requests, including disks, diagnostics, antivirus and processes, remain
in app adapters above the shared bridge. Explorer retains its persisted-language i18n, while
Picture retains its flat-key catalog. Security and Monitor retain their domain error catalogs
and `failureMessage` helpers.

App-specific sidebars, widths and colors remain in the apps. Explorer's `SettingsRow`,
`LoadingSkeleton`, `TransferProgress` and other unique controls, and Backup's `CommonProgress`,
also remain outside the library.

## Usage by app

| App                   | Library features                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `nas-backup-manager`  | Bridge adapter, context, i18n, layout, confirmations, empty states, schedules, styles and tools                     |
| `nas-cleanup-manager` | Context, i18n, layout, modal container, loading, empty states, switch, stepper, sizes, schedules, styles and tools  |
| `nas-disk-manager`    | Bridge adapter, context, i18n, heading, icons, loading, switch, dialogs, styles and tools                           |
| `nas-file-manager`    | Bridge adapter, context, documents, palette, scrollbar and tools, including a storage-specific smoke wrapper        |
| `nas-log-manager`     | Bridge adapter, context, i18n, heading, icons, modal details, styles and tools                                      |
| `nas-mail-client`     | Context, i18n, layout, icons, switch, confirmation, empty folders, modal container and tools                        |
| `nas-picture-manager` | Iframe behavior, NAS palette and tools                                                                              |
| `nas-security-center` | Bridge adapter, context, i18n, icons, switch, stepper, modal container, power intervals, controls, styles and tools |
| `nas-sync-manager`    | Context, i18n, layout, dialogs, confirmation, loading, empty states, stepper, sizes, styles and tools               |
| `nas-system-monitor`  | Bridge adapter, context, i18n, icons, loading, switch, stepper, modal container, documents and controls             |

The shared layout uses a 760px mobile breakpoint. Apps supply their own content, labels and
domain behavior; adopting a shared component does not automatically replace app screens or
app-specific styles.
