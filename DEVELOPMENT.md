# Sviluppo di nas-base-app

Le app di `../external-apps` la usano come dipendenza `@valeriogc/nas-base-app`, la versione
pubblicata su GitHub Packages. Per provare una modifica prima di pubblicarla: `pnpm run build` qui
e, nell'app, temporaneamente `file:../../nas-base-app` con `pnpm install --force`. Non eseguire
comandi Git né creare una `.git`. La pubblicazione è il tag di `release:merge`.

## Struttura

- `src/components/NasIcon.vue`, `NasLoading.vue`, `NasSwitch.vue`: controlli comuni con stili SCSS globali.
- `src/components/NasPageHeader.vue`, `NasModal.vue`, `NasNumberStepper.vue`: intestazione, dialogo e controllo numerico senza logica di dominio.
- `src/components/NasPagination.vue`: navigazione di pagine con modello numerico, etichette fornite dall'app e stili SCSS globali; disponibile per le integrazioni future.
- `src/components/NasConfirmDialog.vue`, `NasEmptyState.vue`: conferma compatta e contenitore degli stati vuoti ricavati dal confronto completo di `external-apps`.
- `src/directives/nativeModal.ts`: ciclo di vita del dialogo nativo.
- `src/services/frameGuard.ts`, `palette.ts`: protezioni iframe e palette.
- `src/services/i18n.ts`, `documents.ts`, `format.ts`, `schedule.ts`, `powerSchedule.ts`: lingua,
  documenti salvati dal backend, dimensioni, testi delle pianificazioni e intervalli di spegnimento.
- `src/components/NasAppLayout.vue`: layout, categorie e richiesta di chiusura locale.
- `src/services/nasShell.ts`: transport del protocollo iframe v1 e ciclo di vita delle richieste.
- `src/services/randomUuid.ts`: UUID v4 con casualità crittografica anche senza `crypto.randomUUID`.
- `src/services/protocol.ts`: validazione dei payload ricevuti.
- `src/composables/useNasLauncherContext.ts`: contesto reattivo, tema e cleanup Vue.
- `src/types/`: contratti pubblici, esportati da `src/index.ts`.
- `src/styles/main.scss`: ingresso degli stili completi, esportato come `nas-base-app/styles.scss`.
- `src/styles/_nas-theme.scss`: palette chiara/scura, token del launcher e alias delle app.
- `src/styles/_nas-*.scss`: layout, classi comuni, controlli e scrollbar.
- `src/styles/global.scss` e `partials/`: variabili, mixin e placeholder riusabili senza regole globali.
- `src/tests/`: test unitari, componenti e script, esclusi dal pacchetto.
- `scripts/index.mjs`: ingresso Node importabile per gli strumenti comuni delle app.
- `scripts/cli.mjs`: il comando `nas-base-app <comando>`, che esegue la CLI del modulo scelto.
- `scripts/backend-paths.mjs`: rilevamento dei due layout Cargo presenti negli originali (workspace Axum e crate diretto di Picture).
- `scripts/build/`: plugin Vite condivisi e `nasPurgeSafelist`, compilati in `dist/vite` da
  `tsconfig.vite.json` ed esportati come `@valeriogc/nas-base-app/vite`.
- `scripts/axium/`: avvio backend, packaging NAS e checker standalone.
- `scripts/pipeline/`: versioni, changelog, verifiche, copertura Rust e Sonar.
- `scripts/`: formatter SFC, lockfile, packaging e rilascio della libreria (`package-library.mjs`,
  `test-package.mjs`, `release-library.mjs`, esclusi dal pacchetto).

Vue è esternalizzata dalla build Vite; non aggiungere una seconda copia al bundle.
`vue-tsc` produce dichiarazioni in `dist/types`, senza plugin di generazione aggiuntivi.
Il pacchetto è ESM e gli stili vengono importati esplicitamente dall'app come SCSS.
`package-styles.mjs` copia gli SCSS in `dist/styles`, mantenendo tutti gli import relativi.
La compilazione Sass avviene nell'app consumatrice, senza dipendenze dai progetti fratelli.

## Convenzioni

Usare TypeScript strict senza `any`, import type-only e SFC con `<script setup lang="ts">`.
Props nel componente, contratti condivisi in `src/types`, stato a due vie con `defineModel`.
I testi UI sono proprietà fornite dall'app. Le icone sono asset SVG importati dal componente
chiamante e passati a `NasIcon` tramite `svg`, senza componenti intermedi con mappe di nomi. Usare sempre file `.scss` per i sorgenti degli stili.
Gli stili comuni dell'app sono globali e stanno nell'ingresso SCSS esplicito; il componente
NasAppLayout usa le stesse classi disponibili nel markup dell'app. Gli eventuali stili specifici
di altri componenti restano scoped SCSS. Nomi CSS con `_`, valori comuni nella partial variables.
Non usare il carattere U+2014.
Evitare effetti globali al momento dell'importazione e ripulire listener e timer allo smontaggio.

I test devono verificare comportamento osservabile: selezione delle categorie, eventi, messaggi
accettati o scartati, risposte correlate, timeout, cleanup, aggiornamenti del contesto.
I selettori nei test componenti usano elementi semantici o testo.

## Dipendenze e lockfile

Lo stack iniziale riprende quello già usato dalle applicazioni NAS. Nessuna dipendenza runtime
oltre alla peer Vue. Per nuove dipendenze oltre a questo stack, proporle prima di aggiungerle.

In locale usare `pnpm install`; `postinstall` sincronizza `package-lock.json` tramite
`scripts/npm-lock.mjs`. Le pipeline possono usare `npm ci`. Dopo `pnpm add/update/remove`, eseguire
`pnpm run lock:npm`. Non modificare manualmente `package-lock.json`.
`pnpm-lock.yaml` resta locale. `lint` controlla anche l'allineamento delle peer dependencies.

## Verifiche

```bash
pnpm run format
pnpm run check
pnpm run test:coverage
pnpm run nas:package
pnpm run nas:test
```

`pnpm run release:test` le esegue tutte, con il controllo dei metadati della release.

`format` usa Prettier, ESLint e il formatter SFC per mantenere le righe vuote richieste nei blocchi
script/style. `format:check` non modifica i file.
La smoke test estrae l'archivio in una directory temporanea e usa la peer Vue installata localmente,
poi verifica le dichiarazioni, compila gli SCSS e il consumer con Vite e prova l'importazione
Node senza DOM, l'ingresso degli strumenti (`/scripts`), i plugin (`/vite`) e il comando
`nas-base-app`. `styles/global.scss` deve restare privo di regole emesse, per evitare di
duplicare gli stili condivisi negli SFC che usano soltanto gli helper Sass.
Non avvia processi NAS e non verifica un launcher reale.

## Estensioni successive

L'integrazione su un NAS reale è da provare con le app installate. Chiusura remota e messaggi
generici tra app richiedono supporto nel launcher. Un componente entra nella libreria quando è
comune ad almeno due app e non porta con sé dati o regole di un dominio; ogni classe o elemento
nuovo dei template va aggiunto a `nasPurgeSafelist` (lo verifica un test).
