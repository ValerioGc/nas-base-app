# @valeriogc/nas-base-app

Libreria Vue 3 delle parti comuni delle applicazioni NAS: layout, tema SCSS, componenti, helper,
comunicazione con il launcher tramite il protocollo iframe `nas: 1` e gli strumenti Node di build,
pacchetto e release delle app. Le dieci app di `external-apps` la usano; le loro versioni
precedenti sono in `external-apps/OLD`.

## Installazione

Il pacchetto è su GitHub Packages. Nell'app:

```ini
# .npmrc del progetto
@valeriogc:registry=https://npm.pkg.github.com
```

```json
"dependencies": { "@valeriogc/nas-base-app": "0.1.0" }
```

In locale serve un token classico con `read:packages` nel proprio `~/.npmrc`
(`//npm.pkg.github.com/:_authToken=...`). Le pipeline delle app usano il `GITHUB_TOKEN` del
workflow: il pacchetto concede la lettura ai loro repository (Package settings, Manage Actions
access). Nel `pnpm-workspace.yaml` locale dell'app, `allowBuilds` deve avere
`'@valeriogc/nas-base-app': false`: lo script `postinstall` della libreria serve solo a lei e,
eseguito come dipendenza, non fa nulla.

Per provare una modifica della libreria in un'app prima di pubblicarla si può usare
temporaneamente `"file:../../nas-base-app"`: dopo `pnpm run build` qui, `pnpm install --force`
nell'app. Prima di committare l'app si torna alla versione pubblicata.

Sono richiesti Vue >= 3.5 e < 4; la build dell'app incorpora la libreria nei bundle, il pacchetto NAS
non ne ha bisogno a runtime.

## Stili pronti e SCSS

```ts
// src/main.ts
import '@valeriogc/nas-base-app/styles.scss';
```

Oppure nel proprio `src/styles/main.scss`, caricato una sola volta dall'app:

```scss
@use '@valeriogc/nas-base-app/styles.scss';
```

L'ingresso include `_nas-theme.scss`, reset, layout, stili base dell'app, controlli e scrollbar.
I sorgenti e gli ingressi pubblici degli stili sono tutti `.scss`. Il bundler dell'app genera
automaticamente il CSS usato dal browser. Non serve importare un file `.css` della libreria.

Il tema contiene la palette chiara e scura delle app NAS, i token `--nas-*` e gli alias già
utilizzati dalle app (`--surface`, `--text`, `--border`, `--muted`, colori di stato).
Il contesto del launcher sovrascrive i token tramite il composable; fuori dal launcher restano
i valori predefiniti. Le superfici dell'iframe e i controlli nativi seguono il tema ricevuto.

Le classi possono essere usate direttamente nel markup, anche senza `NasAppLayout`:

```html
<div class="app_surface">
  <aside class="app_sidebar">
    <nav class="category_navigation" aria-label="Categorie">
      <button class="category_button active" aria-pressed="true">Backup</button>
    </nav>
  </aside>
  <main class="app_content">
    <header class="page_header"><h1>Backup</h1></header>
    <section class="app_panel page_panel">
      <label class="app_field">Nome <input type="text" /></label>
      <div class="app_toolbar">
        <button class="app_button app_button--primary">Salva</button>
        <button class="app_button">Annulla</button>
      </div>
    </section>
  </main>
</div>
```

| Classi                                                                       | Uso                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| `app_surface`, `app_sidebar`, `app_content`                                  | Layout desktop e mobile                       |
| `category_navigation`, `category_button`, `category_icon`                    | Categorie, con stato `active`                 |
| `app_button`, `app_button--primary`, `app_button--icon`, `app_button--small` | Pulsanti e varianti                           |
| `app_icon`                                                                   | Icone immagine con filtro in base al tema     |
| `app_panel`, `surface_card`, `page_panel`, `card_heading`                    | Pannelli e schede                             |
| `app_field`, `field`                                                         | Campi input, select e textarea                |
| `app_toolbar`, `app_scroll`, `page_header`                                   | Toolbar, contenuto scorrevole e titolo pagina |
| `app_error`, `muted`, `sr_only`, `visually_hidden`                           | Messaggi e testi di supporto                  |

`app_panel`, `surface_card`, `app_toolbar`, `app_scroll` e `app_error` si usano dentro
`app_surface`. Le classi definiscono l'aspetto; gestione degli eventi e stati restano all'app.
L'ingresso completo include il reset della pagina, quindi va caricato una volta nell'app/iframe.

Per usare soltanto le variabili, i mixin e i placeholder in uno stile di componente:

```scss
@use '@valeriogc/nas-base-app/styles/global.scss' as *;

.custom_toolbar {
  @include flex_between(12px);
}
```

`global.scss` non emette regole CSS e si può anche iniettare negli SFC tramite la configurazione
Sass di Vite. Le partial sono accessibili da `@valeriogc/nas-base-app/styles/`, per esempio
`@use '@valeriogc/nas-base-app/styles/_nas-theme.scss';` per caricare solo il tema. Le app
caricano soltanto le partial che usano (`_nas-theme`, `partials/_reset`, `_nas-apps`,
`_nas-layout`, `_nas-buttons`, `_nas-controls`, `_nas-scrollbar` e quelle dei componenti), così
la grafica di ciascuna resta la sua.

## Layout e categorie

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
    <section v-if="section === 'scheduled'">
      <!-- Contenuto dell'app -->
    </section>
    <section v-else>
      <!-- Contenuto tempo reale -->
    </section>
  </NasAppLayout>
</template>
```

`categories` accetta `{ value, label, icon?, disabled?, testid? }`; `testid` diventa il
`data-testid` del pulsante, per i test nel browser dell'app. Il valore selezionato si controlla con
`v-model`; il componente non sceglie automaticamente una categoria e non modifica la lista.
Il codice applicativo può intercettare `@update:model-value` usando `:model-value`, per esempio
per confermare l'abbandono di un form con modifiche non salvate.

| Slot           | Parametri            | Uso                                           |
| -------------- | -------------------- | --------------------------------------------- |
| default        | `category`, `value`  | Contenuto del main                            |
| header         | `category`           | Titolo e azioni del main                      |
| sidebar-header | `category`           | Logo o titolo della sidebar                   |
| sidebar-footer | `category`           | Azioni aggiuntive                             |
| icon           | `category`, `active` | Icona personalizzata, anche un componente Vue |

Il layout usa una sidebar verticale su desktop e categorie orizzontali scorrevoli sotto 760px.
I pulsanti sono accessibili da tastiera, hanno stato `aria-pressed` e rispettano `disabled`.
Etichette e traduzioni vengono fornite dall'app.

La proprietà `contained` limita l'app all'altezza dell'iframe e rende scorrevole il contenuto.
`sidebar-attrs` e `content-attrs` permettono di applicare attributi agli elementi interni.
`--nas-app-content-max-width` limita la larghezza del contenuto.

## Altri elementi comuni

- `NasIcon`: `svg` riceve l’SVG importato nel componente chiamante. Vite fornisce l’URL dell’asset, reso come maschera con `currentColor`; gli SVG restano nell’app.
- `NasPageHeader`: `title`, `overview?`, `subtitle?` e slot `actions`; etichette e azioni restano all’app.
- `NasModal`: `label`, `dismissible?` e slot del contenuto; emette `close` su Escape o click sullo sfondo. Usarlo con `v-if` e rimuoverlo quando l’app accetta la chiusura. Il browser gestisce focus e ripristino.
- `NasNumberStepper`: `v-model` numerico intero, `id`, `min`, `max`, `label?`, `increaseLabel`, `decreaseLabel`, `disabled?`, `testid?`. Respinge input vuoti, frazionari o fuori intervallo.
- `NasPagination`: `v-model` della pagina corrente (da 1), `totalPages`, `label`, `previousLabel`, `nextLabel`, `pageLabel(page)`, `disabled?`, `testid?`. Pulsanti precedente/successiva, numeri di pagina e intervalli compatti con ellissi.
- `NasConfirmDialog`: `title`, `message`, `cancelLabel`, `confirmLabel`, `confirmDisabled?`, `busy?`, `testid?`, `cancelTestid?`, `confirmTestid?` e uno slot mostrato sotto i pulsanti (per esempio l'errore dell'azione). Dialogo nativo compatto; emette `cancel` e `confirm`, con autofocus su annulla. Usarlo con `v-if`; l'app decide quando smontarlo. `busy` blocca entrambi i pulsanti ed Escape, `confirmDisabled` blocca solo la conferma.
- `NasEmptyState`: `title`, `description?`, `svg?` importato dall'app, slot `icon` e `actions`. Stato vuoto generico per liste o risultati; non decide quando mostrarlo né gestisce il caricamento.
- `NasLoading`: `label` è il testo annunciato con `aria-live="polite"`; rispetta reduced motion.
- `NasSwitch`: `v-model` booleano, `label`, `disabled` e `testid` opzionali; usa un input nativo.
- `vNasModal`: apre un `<dialog v-if="..." v-nas-modal>` con `showModal()` e lo chiude allo smontaggio.
  L'app gestisce `cancel`, pulsanti, conferme e stato del dialogo.
- `guardFrame()`: applica le protezioni condivise dell'iframe, da chiamare nell'ingresso dell'app.
- `applyNasPalette(palette, root?)`: valida e applica i colori del launcher, anche fuori dal composable.
- `createNasI18n(messages, initial?)`: lingua dell'app (`locale`, `setLocale`, `useI18n` con `t`);
  i cataloghi restano all'app, `setLocale` aggiorna anche `lang` della pagina.
- `storedDocument(name, { parse, url?, legacyKey? })`: un documento JSON del backend dell'app
  (`api/documents/<nome>`), letto con `load()` e salvato poco dopo ogni modifica; le pagine dello
  stesso browser si seguono con `BroadcastChannel`, le altre rileggono quando tornano visibili.
- `formatBytes(bytes, locale)` e `share(part, whole)`: dimensioni leggibili e percentuali fino a 100.
- `randomUuid()`: identificativo UUID v4 con casualità crittografica, anche senza `crypto.randomUUID`.
- `describeSchedule`, `scheduleKind`, `weekdayName`, `monthName`: testi di una pianificazione
  `NasSchedule` (`daily`, `weekly`, `monthly`, `yearly`) con i modelli del catalogo dell'app.
- `minuteOf`, `offRanges`, `offAt`, `powerWeekdays`: minuti di un orario e intervalli in cui la
  pianificazione energetica del NAS lo tiene spento.

Importare l’SVG nello stesso file Vue in cui si usa l’icona:

```vue
<script setup lang="ts">
import { NasIcon } from '@valeriogc/nas-base-app';
import refreshIcon from './assets/refresh.svg';
</script>

<template>
  <button type="button"><NasIcon :svg="refreshIcon" /> Aggiorna</button>
</template>
```

La prop `svg` è una stringa URL restituita dall’import standard di Vite; non richiede plugin SVG
Vue o import `?raw`. Non esiste una mappa di nomi imposta dalla libreria. `NasIcon` è decorativa:
l’etichetta accessibile va sul pulsante o sul controllo che la contiene.

I componenti usano gli stili dell'ingresso SCSS comune. Le classi `app_loading`, `loading_spinner`,
`app_switch`, `app_switch_track`, `app_switch_label`, `app_icon_mask`, `tone_text_*`,
`app_modal`, `nas_page_header`, `number_stepper`, `number_steps`, `step_arrow`,
`nas_pagination`, `nas_pagination_pages`, `nas_pagination_page`, `nas_pagination_gap`,
`nas_confirm_dialog`, `nas_confirm_message`, `nas_confirm_actions`, `nas_empty_state`, `nas_empty_icon` e `nas_empty_actions`
sono utilizzabili direttamente nel markup.

### Paginazione

Il paginatore è già disponibile nella libreria, senza aggiungerlo alle schermate delle app.
L'app gestisce dati, caricamento e numero totale delle pagine; il componente emette soltanto
`update:modelValue` quando viene scelta una pagina diversa.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { NasPagination } from '@valeriogc/nas-base-app';

const page = ref(1);
const totalPages = ref(12);
const labels = {
  navigation: 'Pagine dei risultati',
  previous: 'Precedente',
  next: 'Successiva',
  page: (value: number) => `Pagina ${value}`,
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

Nell'app reale fornire i testi dal proprio catalogo i18n. La pagina attiva usa `aria-current="page"`;
tutti i pulsanti sono nativi e utilizzabili da tastiera. `disabled` blocca la navigazione durante
il caricamento. Con zero pagine non sono mostrati numeri e le azioni sono disabilitate.
Il numero totale deve essere un intero non negativo; valori non validi vengono trattati come zero.
Se il totale diminuisce, la pagina visualizzata è limitata all'intervallo disponibile senza
modificare automaticamente il modello: il reset dopo filtri o nuove ricerche resta all'app.
Prima e ultima pagina rimangono raggiungibili anche con migliaia di pagine, con al massimo
sette elementi nell'elenco. Il layout va a capo negli spazi stretti; `--nas-pagination-gap`
e `--nas-pagination-page-size` personalizzano spaziatura e larghezza minima dei numeri.

### Chiusura

Passando `close-label` si mostra un pulsante che emette `close`. `close-disabled` permette di
bloccarlo durante un salvataggio. L'app decide come gestire la richiesta.

**Il launcher attuale non gestisce messaggi `close`.** La libreria quindi non può chiudere una
finestra del launcher: l'evento permette di predisporre il comportamento locale o una futura
integrazione. Non viene inviato un comando non supportato.

## Contesto launcher

Chiamare `useNasLauncherContext()` una sola volta nel componente radice dell'app.
Il composable registra il listener prima di inviare `ready`, aggiorna tema, colore accent,
palette e lingua a ogni messaggio `context`, e restituisce:

- `shell`: bridge per le operazioni sul launcher.
- `locale`, `theme`, `active`, `context`: ref in sola lettura. `active` diventa vero quando arriva un contesto valido.

In modalità standalone legge `?lang=it|en&theme=light|dark`; i valori predefiniti sono italiano
e tema chiaro. Le opzioni `locale` e `theme` cambiano i valori predefiniti.
`onLocaleChange` consente di collegare l'i18n dell'app, senza imporre un catalogo alla libreria.
Le lingue supportate inizialmente sono `it` e `en`.

Il composable applica `data-theme`, `data-nas-shell`, `--accent` e i token `--nas-background`,
`--nas-foreground`, `--nas-surface`, `--nas-sunken`, `--nas-hover`, `--nas-border`, `--nas-muted`
su `document.documentElement`. I colori mancanti o invalidi rimuovono l'override.
Allo smontaggio vengono ripristinati gli attributi e i token precedenti.
Si può passare `root` per usare un elemento diverso, oppure `root: null` per disabilitare le
modifiche DOM. Usare un solo composable per ogni root, per evitare ripristini in concorrenza.

Gli stili condivisi forniscono colori di base chiari e scuri e il reset della pagina dell'app.
Sono personalizzabili anche `--nas-app-sidebar-width`, `--nas-app-content-padding`,
`--nas-app-mobile-padding`, `--nas-app-sidebar-padding`, `--nas-app-nav-padding`,
`--nas-app-nav-gap`, `--nas-app-icon-gap`, `--nas-app-icon-size`, `--nas-app-radius`.

## Bridge e comunicazione tra app

`createNasShell()` è utilizzabile anche senza il composable. Ogni istanza possiede i propri
listener e richieste; chiamare `dispose()` quando non serve più. Importare il pacchetto in SSR
non accede a `window` o `document`.

| Metodo                                      | Comportamento                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `listen(callback)`                          | Riceve contesto e notifiche descritte; restituisce una funzione di unsubscribe                                            |
| `ready()`                                   | Richiede il contesto al launcher                                                                                          |
| `openApp(id, location?)`                    | Apre un'altra app; location è una query fino a 2048 caratteri, che inizia con `?`                                         |
| `openHttps()`                               | Chiede al launcher di riaprirsi in HTTPS: un'app non può far navigare la pagina che la contiene                           |
| `notify(title, message?, tone?)`            | Invia una notifica; tone: info, success, warning, error                                                                   |
| `describeNotifications(list)`               | Richiede etichette tradotte, ricevute da `listen` come `described`                                                        |
| `pickFiles(options?)`                       | Richiede file; restituisce `{ files, cancelled }`                                                                         |
| `pickFolder(directory?, timeoutMs?)`        | Richiede una cartella                                                                                                     |
| `requestFolderShortcut(path, name)`         | Crea un collegamento; consentito dal launcher solo a nas-file-manager                                                     |
| `requestNetworkDisks()`                     | Legge i dischi di rete del provider installato                                                                            |
| `requestPowerSchedule()`                    | Legge la pianificazione energetica                                                                                        |
| `request(type, payload?, options?)`         | Invia un comando specifico dell’app, correla la risposta `type-result` e restituisce `{ success, data?, error?, taskId? } |
| `sendPickedFiles(token, files, cancelled?)` | Risponde al picker come provider                                                                                          |
| `dispose()`                                 | Rimuove listener, cancella timer e rifiuta le richieste ancora pendenti                                                   |

I metodi senza risposta restituiscono `false` fuori dall'iframe o dopo `dispose`; `true` indica
che il messaggio è stato inviato, senza confermare l'esecuzione nel launcher.
`request()` lascia all’app la gestione di `success: false` e dei dati specifici del comando.
Gli altri metodi con risposta restituiscono Promise e rifiutano con `NasShellError` nei casi
`unavailable`, `timeout`, `disposed`, `invalid-response`, `launcher-error`.

Timeout predefinito 10 secondi, configurabile con `createNasShell({ timeoutMs })`.
Il picker ha un timeout separato di 5 minuti, configurabile in `pickFiles({ timeoutMs })`;
i dischi di rete aspettano almeno 45 secondi perché il provider può dover partire.
`FilePickerOptions` accetta `multiple`, `folder`, `extensions` (con punto iniziale) e `directory`.

Tutti i messaggi usano il protocollo esistente `nas: 1`, senza wildcard per l'origine.
Sono accettati solo messaggi di `window.parent` con la stessa origine dell'app e payload validati.
L'istanza non comunica con finestre arbitrarie. L'apertura di altre app e il picker passano dal
launcher; un bus generico per messaggi diretti tra app richiederà un contratto aggiuntivo.

## Sviluppo e verifiche

```bash
pnpm run check
pnpm run nas:package
pnpm run nas:test
```

`check` esegue formattazione, lint, test unitari e componenti, controlli TypeScript e build.
`nas:test` verifica SHA256 e contenuto dell'archivio, compila gli ingressi SCSS e un'app Vue
temporanea che usa solo il pacchetto estratto e verifica l'importazione ESM senza browser.
Richiede `tar`.
Non prova l'integrazione con un NAS reale.

In questa libreria `nas:package` produce un archivio **npm**, non il pacchetto di un'app NAS
con backend Rust, manifest e servizio systemd. La libreria non contiene codice che modifica il
sistema. `pnpm run test:coverage` misura la copertura dei sorgenti (soglia 80%).

## Strumenti delle app

Il pacchetto installa il comando `nas-base-app`, usato dagli script di `package.json` delle app e
dai loro workflow, sempre dalla cartella dell'app:

| Comando                              | Uso                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `format-sfc [--check]`               | Righe vuote attorno a script e style degli SFC                              |
| `lock --sync`, `lock --check`        | `package-lock.json` allineato a `package.json`                              |
| `backend-dev`                        | Backend Cargo sul socket di sviluppo                                        |
| `package`                            | Pacchetto NAS in `release-assets/`, con la sola versione precedente accanto |
| `test-package [archivio] [opzioni]`  | Checker autonomo del pacchetto                                              |
| `smoke [opzioni]`                    | Checker sul pacchetto della versione corrente                               |
| `release-check [tag]`, `changelog v` | Metadati della release e sezione del changelog                              |
| `release-test`, `release-merge`      | Gate completo e merge con tag della release                                 |
| `coverage-rust [--fail-under-lines]` | Copertura Rust in `backend/coverage/lcov.info`                              |
| `sonar`                              | Clippy e scansione Sonar                                                    |

Le configurazioni Vite importano `frontendBoundary`, `stripTestIds`, `stripTestIdsNodeTransform` e
`nasPurgeSafelist` da `@valeriogc/nas-base-app/vite`: `nasPurgeSafelist` elenca classi ed elementi
dei componenti della libreria, che PurgeCSS non trova nei sorgenti dell'app. Le funzioni Node sono
importabili da `@valeriogc/nas-base-app/scripts` (vedere [scripts/README.md](scripts/README.md)).

## Rilascio

Come le app:

```bash
pnpm run release:check   # tag, package.json e CHANGELOG.txt dicono la stessa versione
pnpm run release:test    # check, copertura, pacchetto npm e sua verifica
pnpm run release:merge   # versione, changelog, gate, commit, merge su main, tag e push
```

`release:merge` accetta `-- --type=minor|major`, `-- --branch=main` e `-- --dry-run`. Il tag
`vX.Y.Z` avvia `.github/workflows/publish.yml`, che ripete il gate e pubblica su GitHub Packages.
Vedere [COMPONENTS.md](COMPONENTS.md) per il confronto dei componenti delle app e
[DEVELOPMENT.md](DEVELOPMENT.md) per struttura e convenzioni.
