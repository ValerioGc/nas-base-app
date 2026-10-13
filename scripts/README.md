# Strumenti comuni delle app NAS

Le app li eseguono con il comando `nas-base-app`, installato con la libreria, dagli script del
proprio `package.json` e dai workflow. Backend, manifest e configurazioni restano nell'app.

## Comandi e percorsi

Eseguire i comandi dalla cartella dell'app: gli strumenti usano quella cartella come root, non la
directory in cui si trova lo script condiviso. `package` legge `nas-app.json`, `package.json` e i
metadati Cargo del consumer e scrive il suo archivio in `release-assets/`, dove poi lascia solo
quella versione e la precedente (`prune-assets.mjs`): gli altri file con una versione nel nome,
anche di nomi vecchi del pacchetto, vengono eliminati. Il formatter carica
Prettier e la configurazione del consumer.

| Script dell'app                                  | Comando                                                       | Modulo                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `format`, `format:check`, `format:sfc`           | `nas-base-app format-sfc [--check]`                           | `format-sfc-spacing.mjs`                                                  |
| `lint`, `postinstall`                            | `nas-base-app lock --check`, `--sync`                         | `npm-lock.mjs`                                                            |
| `backend:dev`                                    | `nas-base-app backend-dev`                                    | `axium/backend-dev.mjs`                                                   |
| `nas:package`                                    | `nas-base-app package` (dopo build frontend e Cargo)          | `axium/package-nas.mjs`                                                   |
| `nas:test`                                       | `nas-base-app smoke [--env K=V]`                              | `axium/smoke-nas.mjs`, `axium/test-nas-package.mjs`                       |
| `release:check`, `release:test`, `release:merge` | `nas-base-app release-check`, `release-test`, `release-merge` | `pipeline/verify_release.mjs`, `prepare_release.mjs`, `merge_release.mjs` |
| `coverage:rust`, `test:sonar`                    | `nas-base-app coverage-rust`, `sonar`                         | `pipeline/coverage-rust.mjs`, `sonar.mjs`                                 |
| note di release nei workflow                     | `nas-base-app changelog <versione>`                           | `pipeline/extract-changelog.cjs`                                          |

`smoke` usa il pacchetto della versione corrente; opzioni senza archivio (`--env`, `--timeout`) si
aggiungono a quelle predefinite. Il checker resta autonomo: richiede solo i moduli builtin di Node e
si può copiare ed eseguire da una cartella indipendente (`test-package --help`).

## Importazione

L'ingresso Node `@valeriogc/nas-base-app/scripts` è separato da quello del browser. Importarlo non
avvia backend, processi, release o scansioni e non legge i manifest dell'app:

```js
import { checkLock, formatSfc, smokeNas, verifyRelease } from '@valeriogc/nas-base-app/scripts';

const root = process.cwd();
checkLock(root);
await formatSfc({ root, checkOnly: true });
verifyRelease(undefined, root);
await smokeNas([], root, { env: { NAS_STORAGE_ROOT: '/tmp/storage' } });
```

`startBackend({ root, socket?, uiDir?, cargo?, env? })` restituisce il processo Cargo; il chiamante
ne gestisce errori e arresto. `testNasPackage(args, root?)` accetta gli argomenti del checker senza
avviare un altro processo Node. `smokeNas(args?, root?, { env? })` aggiunge le variabili come
`--env`. `extractChangelog(version, root?)`, `verifyRelease(tag?, root?)`, `prepareRelease(root?)`,
`coverageRust(root?, { failUnderLines? })` e `runSonar(root?, { rust? })` accettano una root esplicita.
`rust` resta `true` per le app; `false` salta Clippy per la libreria, come la CLI `sonar --no-rust`.
`mergeRelease({ type?, branch?, dryRun?, bump?, prepare? })` e `latestTag(root?)` usano Git e
vanno eseguiti solo per un rilascio vero; `bump` e `prepare` sostituiscono aggiornamento della
versione e gate per progetti diversi da un'app NAS, come la libreria stessa.

Avvio, packaging e metadati rilevano il crate `backend/axum/Cargo.toml` oppure il crate diretto
`backend/Cargo.toml` di Picture. Il checker conosce le reti `smtp` e `sync` e le capability
richiamate solo dal launcher sotto `/internal/` (`mail-events`, `cache`, `trash`).

## Eseguibili degli strumenti

Gli script di sviluppo e release usano `process-tools.mjs`: eseguibili assoluti e un PATH
costruito dalle directory di sistema e delle installazioni Node/Rust dell'utente. Le directory
del progetto, le voci relative e il PATH passato dal consumer non vengono usati per scegliere
gli strumenti. File, directory e antenati devono appartenere a root o all'utente corrente e
non essere scrivibili da utenti non fidati; il gruppo personale dell'utente è ammesso.

I workflow CI e Publish restringono i permessi della toolcache Node subito dopo `setup-node`:
i runner GitHub la preparano con permessi di scrittura condivisi, incompatibili con questi
controlli. Il passaggio rimuove la scrittura per gruppo e altri utenti dalla directory della
cache e dall'installazione Node, mantenendo i controlli degli script anche in pipeline.

Installazioni diverse si indicano con percorsi assoluti tramite `NAS_CARGO_EXECUTABLE`,
`NAS_NPM_EXECUTABLE`, `NAS_GIT_EXECUTABLE` e `NAS_PODMAN_EXECUTABLE`. Anche questi percorsi
vengono controllati. `CARGO_HOME` individua l'installazione Rust; i wrapper del compilatore
vengono risolti soltanto nelle directory fidate.

I plugin Vite si importano da `@valeriogc/nas-base-app/vite`, compilati in JavaScript: non entrano
nel bundle frontend e usano i tipi di Vite e Vue già presenti nell'app.
