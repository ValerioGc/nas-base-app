import { randomUuid } from './randomUuid';
import {
  isContext,
  isNetworkDisk,
  isNotification,
  isPickedFile,
  isPowerSchedule,
  isRecord,
} from './protocol';
import type {
  FilePickerOptions,
  FilePickerResult,
  NasShell,
  NasShellErrorCode,
  NasShellOptions,
  ShellEvent,
} from '../types/launcher';

interface PendingRequest {
  type: string;
  resolve: (message: Record<string, unknown>) => void;
  reject: (error: NasShellError) => void;
  timer: ReturnType<typeof setTimeout>;
  accept: (message: Record<string, unknown>) => boolean;
}

export class NasShellError extends Error {
  constructor(
    public readonly code: NasShellErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'NasShellError';
  }
}

function invalidResponse(): never {
  throw new NasShellError('invalid-response', 'Invalid launcher response');
}

function successful(message: Record<string, unknown>): void {
  if (typeof message.success !== 'boolean') {
    invalidResponse();
  }
  if (!message.success) {
    throw new NasShellError(
      'launcher-error',
      typeof message.error === 'string' ? message.error : 'Launcher request failed',
    );
  }
}

function validTimeout(timeout: number): number {
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2147483647) {
    throw new RangeError('timeoutMs must be a positive finite timer duration');
  }
  return timeout;
}

/** Same-origin protocol v1. Each instance owns its listeners and pending requests. */
export function createNasShell(options: NasShellOptions = {}): NasShell {
  const view =
    options.view === undefined ? (typeof window === 'undefined' ? null : window) : options.view;
  const timeoutMs = validTimeout(options.timeoutMs ?? 10000);
  const pending = new Map<string, PendingRequest>();
  const listeners = new Set<(message: ShellEvent) => void>();
  let registered = false;
  let disposed = false;

  function available(): boolean {
    return !disposed && view !== null && view.parent !== view;
  }

  function detachIfIdle(): void {
    if (registered && listeners.size === 0 && pending.size === 0) {
      view?.removeEventListener('message', receive);
      registered = false;
    }
  }

  function receive(event: MessageEvent<unknown>): void {
    if (
      !view ||
      !available() ||
      event.origin !== view.location.origin ||
      event.source !== view.parent
    ) {
      return;
    }
    const message = event.data;
    if (!isRecord(message) || message.nas !== 1 || typeof message.type !== 'string') {
      return;
    }
    if (typeof message.requestId === 'string') {
      const request = pending.get(message.requestId);
      if (!request || request.type !== message.type || !request.accept(message)) {
        return;
      }
      clearTimeout(request.timer);
      pending.delete(message.requestId);
      request.resolve(message);
      detachIfIdle();
      return;
    }
    let eventMessage: ShellEvent;
    if (message.type === 'context' && isContext(message.context)) {
      eventMessage = { nas: 1, type: 'context', context: message.context };
    } else if (
      message.type === 'described' &&
      Array.isArray(message.notifications) &&
      message.notifications.every(isNotification)
    ) {
      eventMessage = { nas: 1, type: 'described', notifications: message.notifications };
    } else {
      return;
    }
    for (const listener of listeners) {
      listener(eventMessage);
    }
  }

  function register(): void {
    if (!registered && view && available()) {
      view.addEventListener('message', receive);
      registered = true;
    }
  }

  function post(message: Record<string, unknown>): boolean {
    if (!view || !available()) {
      return false;
    }
    view.parent.postMessage({ ...message, nas: 1 }, view.location.origin);
    return true;
  }

  function request<T>(
    type: string,
    payload: Record<string, unknown>,
    wait: number,
    read: (message: Record<string, unknown>) => T,
    accept: (message: Record<string, unknown>) => boolean = () => true,
  ): Promise<T> {
    if (!view || !available()) {
      return Promise.reject(
        new NasShellError(disposed ? 'disposed' : 'unavailable', 'Launcher unavailable'),
      );
    }
    validTimeout(wait);
    const requestId = randomUuid(view.crypto);
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        detachIfIdle();
        reject(new NasShellError('timeout', 'Launcher request timed out'));
      }, wait);
      pending.set(requestId, { type: `${type}-result`, resolve, reject, timer, accept });
      register();
      try {
        post({ ...payload, type, requestId });
      } catch {
        clearTimeout(timer);
        pending.delete(requestId);
        detachIfIdle();
        reject(new NasShellError('unavailable', 'Launcher unavailable'));
      }
    }).then(read);
  }

  function pickFiles(picker: FilePickerOptions = {}): Promise<FilePickerResult> {
    const { timeoutMs: pickerTimeout = 300000, ...payload } = picker;
    if (
      payload.directory !== undefined &&
      (!payload.directory.startsWith('/') || payload.directory.length > 2048)
    ) {
      throw new TypeError('directory must be an absolute path of at most 2048 characters');
    }
    if (
      payload.extensions &&
      (payload.extensions.length > 32 ||
        !payload.extensions.every((extension) => /^\.[a-z0-9]{1,10}$/i.test(extension)))
    ) {
      throw new TypeError('extensions must contain at most 32 file extensions, including the dot');
    }
    return request(
      'pick-files',
      payload,
      pickerTimeout,
      (message) => {
        if (typeof message.error === 'string' && message.error && message.cancelled !== true) {
          throw new NasShellError('launcher-error', message.error);
        }
        if (
          !Array.isArray(message.files) ||
          !message.files.every(isPickedFile) ||
          typeof message.cancelled !== 'boolean'
        ) {
          invalidResponse();
        }
        return {
          files: message.files,
          cancelled: message.cancelled,
          ...(typeof message.error === 'string' ? { error: message.error } : {}),
        };
      },
      (message) => Array.isArray(message.files) && typeof message.cancelled === 'boolean',
    );
  }

  return {
    get available() {
      return available();
    },
    listen(listener) {
      if (disposed) {
        throw new NasShellError('disposed', 'Bridge disposed');
      }
      listeners.add(listener);
      register();
      return () => {
        listeners.delete(listener);
        detachIfIdle();
      };
    },
    ready: () => post({ type: 'ready' }),
    openApp(app, location) {
      if (!app.trim()) {
        throw new TypeError('app must not be empty');
      }
      if (location !== undefined && (!location.startsWith('?') || location.length > 2048)) {
        throw new TypeError('location must be a query string of at most 2048 characters');
      }
      return post({ type: 'open', app, ...(location === undefined ? {} : { location }) });
    },
    openHttps: () => post({ type: 'open-https' }),
    notify: (title, message = '', tone = 'info') => post({ type: 'notify', title, message, tone }),
    describeNotifications: (notifications) => post({ type: 'describe', notifications }),
    sendPickedFiles: (token, files, cancelled = false) =>
      post({ type: 'files-picked', token, files, cancelled }),
    request(type, payload = {}, options = {}) {
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(type)) {
        throw new TypeError('Request type must be a protocol command name');
      }
      return request(
        type,
        payload,
        options.timeoutMs ?? timeoutMs,
        (message) => ({
          success: message.success === true,
          data: message.data,
          error: typeof message.error === 'string' ? message.error : undefined,
          taskId: typeof message.taskId === 'string' ? message.taskId : undefined,
        }),
        (message) => typeof message.success === 'boolean',
      );
    },
    pickFiles,
    pickFolder: (directory, wait) => pickFiles({ folder: true, directory, timeoutMs: wait }),
    requestFolderShortcut: (path, name) =>
      request(
        'shortcut',
        { path, name },
        timeoutMs,
        successful,
        (message) => typeof message.success === 'boolean',
      ),
    requestNetworkDisks: () =>
      request('network-disks', {}, Math.max(timeoutMs, 45000), (message) => {
        successful(message);
        if (!Array.isArray(message.data) || !message.data.every(isNetworkDisk)) {
          invalidResponse();
        }
        return message.data;
      }),
    requestPowerSchedule: () =>
      request('power-schedule', {}, timeoutMs, (message) => {
        successful(message);
        if (!isPowerSchedule(message.data)) {
          invalidResponse();
        }
        return message.data;
      }),
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new NasShellError('disposed', 'Bridge disposed'));
      }
      pending.clear();
      listeners.clear();
      detachIfIdle();
    },
  };
}
