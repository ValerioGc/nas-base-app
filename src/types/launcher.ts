export type NasTheme = 'light' | 'dark';
export type NasLocale = 'it' | 'en';
export type NotificationTone = 'info' | 'success' | 'warning' | 'error';
export type PaletteRole = 'background' | 'foreground' | 'surface' | 'sunken' | 'hover' | 'border' | 'muted';

export interface AppContext {
  app: string;
  nasName?: string;
  theme: NasTheme;
  accent: string;
  locale: string;
  palette?: Partial<Record<PaletteRole, string>>;
}

export interface NasNotification {
  id: string;
  title: string;
  message: string;
  source: string;
  key?: string | null;
  params?: Record<string, string>;
}

export interface DescribedNotification {
  id: string;
  title: string;
  message: string;
  source: string;
}

export interface PickedFile {
  name: string;
  path: string;
  url?: string;
}

export interface FilePickerOptions {
  multiple?: boolean;
  folder?: boolean;
  extensions?: string[];
  directory?: string;
  timeoutMs?: number;
}

export interface FilePickerResult {
  files: PickedFile[];
  cancelled: boolean;
  error?: string;
}

export interface NasShellAnswer {
  success: boolean;
  data?: unknown;
  taskId?: string;
  error?: string;
}

export interface NasRequestOptions {
  timeoutMs?: number;
}

export interface PickerFile {
  name: string;
  path: string;
  download: string;
}

export interface NetworkDisk {
  name: string;
  mount: string;
  source: string | null;
  readOnly: boolean;
}

export type PowerDay =
  | 'everyday'
  | 'weekdays'
  | 'weekends'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface PowerRule {
  day: PowerDay;
  time: string;
  action: 'start' | 'shutdown' | 'restart';
}

export interface PowerSchedule {
  enabled: boolean;
  rules: PowerRule[];
}

export type ShellEvent =
  | { nas: 1; type: 'context'; context: AppContext }
  | { nas: 1; type: 'described'; notifications: DescribedNotification[] };

export type NasShellErrorCode =
  'unavailable' | 'timeout' | 'disposed' | 'invalid-response' | 'launcher-error';

export interface NasShellOptions {
  view?: Window | null;
  timeoutMs?: number;
}

export interface NasShell {
  readonly available: boolean;
  listen(listener: (message: ShellEvent) => void): () => void;
  ready(): boolean;
  openApp(app: string, location?: string): boolean;
  openHttps(): boolean;
  notify(title: string, message?: string, tone?: NotificationTone): boolean;
  describeNotifications(notifications: NasNotification[]): boolean;
  pickFiles(options?: FilePickerOptions): Promise<FilePickerResult>;
  pickFolder(directory?: string, timeoutMs?: number): Promise<FilePickerResult>;
  requestFolderShortcut(path: string, name: string): Promise<void>;
  requestNetworkDisks(): Promise<NetworkDisk[]>;
  requestPowerSchedule(): Promise<PowerSchedule>;
  request(
    type: string,
    payload?: Record<string, unknown>,
    options?: NasRequestOptions,
  ): Promise<NasShellAnswer>;
  sendPickedFiles(token: string, files: PickerFile[], cancelled?: boolean): boolean;
  dispose(): void;
}

export interface NasContextOptions {
  shell?: NasShell;
  root?: HTMLElement | null;
  locale?: NasLocale;
  theme?: NasTheme;
  onLocaleChange?: (locale: NasLocale) => void;
}
