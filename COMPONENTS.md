# Confronto dei componenti delle app

Il confronto riguarda le dieci app di `external-apps`, che ora usano la libreria. Le versioni
precedenti alla migrazione sono in `external-apps/OLD`. Una parte entra nella libreria quando è
comune ad almeno due app e non porta con sé dati o regole di un dominio.

## Componenti

| Componente                | Provenienza                                                          | Contratto nella libreria                                                    |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `NasAppLayout`            | `AppSidebar` di Backup, Pulizia e Mail                               | Categorie con icona e `testid`, slot di intestazione, piede e contenuto     |
| `NasPageHeader`           | `AppHeader` dei Log e `PageHeader` dei Dischi                        | Titolo, overview, sottotitolo, slot azioni                                  |
| `NasModal`                | Dettagli dei Log, `CommonModal` di Pulizia, Mail, Security e Monitor | Dialogo nativo con etichetta e richiesta di chiusura; intestazioni all'app  |
| `vNasModal`               | Direttiva dei dialoghi dei Dischi                                    | `showModal()` al montaggio e `close()` allo smontaggio                      |
| `NasConfirmDialog`        | `ConfirmDialog` di Mail e Sync, `DiscardRuleDialog` di Backup        | Titolo, messaggio, pulsanti con `testid`, stato busy e slot sotto le azioni |
| `NasEmptyState`           | `CommonList` di Backup e cartella vuota di Mail                      | Titolo, descrizione, icona o slot, azioni                                   |
| `.nas_empty_framed`       | Liste vuote di Pulizia e Sync                                        | Cornice tratteggiata e badge tondo (`.nas_empty_badge`) per lo stato vuoto  |
| `NasNumberStepper`        | `NumberStepper` di Monitor e Security                                | Intero con limiti, etichette e `testid` dall'app                            |
| `NasIcon`                 | `AppIcon` di Mail, Log, Dischi, Security e Monitor                   | SVG importato dal chiamante, nessun registro di nomi                        |
| `NasLoading`, `NasSwitch` | `AppLoading` e `AppSwitch` di Dischi, Mail, Security e Monitor       | Caricamento annunciato e interruttore nativo                                |
| `NasPagination`           | Nessuna app (predisposto)                                            | Pagina corrente, totale, etichette tradotte                                 |

`CommonModal` resta nelle app che lo usano: intestazione, pulsante di chiusura, piede e dimensioni
sono loro, il contenitore è `NasModal`. La conferma della sync ha ora il dialogo nativo; quella di
Mail e Backup era già identica. `NasNumberStepper`, a un valore digitato
fuori intervallo, mostra di nuovo il valore tenuto (il modello non cambiava già prima).

## Codice non Vue

| Parte                                                       | Provenienza                            | Nella libreria                                    |
| ----------------------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| Bridge del launcher e contesto                              | `nasShell.ts` e composable di tutte    | `createNasShell`, `useNasLauncherContext`         |
| Protezioni dell'iframe                                      | `frameGuard.ts`, identico in tutte     | `guardFrame`                                      |
| Runtime i18n                                                | Otto app con lo stesso modulo          | `createNasI18n`                                   |
| Documenti del backend                                       | `documents.ts` di Explorer, Monitor    | `storedDocument`                                  |
| Dimensioni e percentuali                                    | `format.ts` di Pulizia e Sync          | `formatBytes`, `share`                            |
| Testi delle pianificazioni                                  | `scheduleText.ts` di Backup, Pulizia   | `describeSchedule`, `scheduleKind`, nomi          |
| Intervalli di spegnimento                                   | `usePowerSchedule` di Backup, Security | `offRanges`, `offAt`, `minuteOf`, `powerWeekdays` |
| Tema, reset, palette, layout, controlli, scrollbar, partial | `styles/` di tutte                     | Partial SCSS caricate una per una dalle app       |
| Script di build, pacchetto, release, copertura e Sonar      | `scripts/` di tutte                    | Comando `nas-base-app`, `/scripts`, `/vite`       |

Restano nelle app: le richieste specifiche al launcher (dischi, diagnostica, antivirus, processi),
adattate in `services/nasShell.ts` sopra il bridge della libreria con le stesse risposte di prima;
il runtime i18n di Explorer (lingua salvata) e di Picture (chiavi piatte); `failureMessage` di
Security e Monitor (cataloghi di errori diversi); le sidebar di Log, Dischi, Security e Monitor,
con colori e larghezze propri; `SettingsRow`, `LoadingSkeleton`, `TransferProgress` e gli altri
componenti di Explorer, e `CommonProgress` di Backup, presenti in una sola app.

## Per app

| App                   | Dalla libreria                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `nas-backup-manager`  | Bridge (adattatore), contesto, i18n, layout, conferme, stato vuoto, pianificazioni, stili, script                                         |
| `nas-cleanup-manager` | Contesto, i18n, layout, `CommonModal` su `NasModal`, caricamento, stato vuoto, switch, stepper, dimensioni, pianificazioni, stili, script |
| `nas-disk-manager`    | Bridge (adattatore), contesto, i18n, intestazione, icone, caricamento, switch, dialoghi, stili, script                                    |
| `nas-file-manager`    | Bridge (adattatore), contesto, documenti, palette, scrollbar, script (smoke con storage proprio)                                          |
| `nas-log-manager`     | Bridge (adattatore), contesto, i18n, intestazione, icone, dettaglio su `NasModal`, stili, script                                          |
| `nas-mail-client`     | Contesto, i18n, layout, icone, switch, conferma, cartella vuota, `CommonModal` su `NasModal`, script                                      |
| `nas-picture-manager` | Protezioni dell'iframe, palette NAS, script                                                                                               |
| `nas-security-center` | Bridge (adattatore), contesto, i18n, icone, switch, stepper, `CommonModal`, spegnimenti, controlli, stili, script                         |
| `nas-sync-manager`    | Contesto, i18n, layout, dialogo, conferma, caricamento, stato vuoto, stepper, dimensioni, stili, script                                   |
| `nas-system-monitor`  | Bridge (adattatore), contesto, i18n, icone, caricamento, switch, stepper, `CommonModal`, documenti, controlli                             |

Il CSS compilato di ogni app è stato confrontato regola per regola con quello precedente: restano
differenze equivalenti (stesse regole sotto i nomi della libreria), il `color-scheme` della pagina
fuori dal launcher, i breakpoint mobili delle sidebar diventate `NasAppLayout` (760px invece di
700px) e i contenitori dei dialoghi nativi.
