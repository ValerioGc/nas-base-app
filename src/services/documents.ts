import { ref, watch, type Ref } from 'vue';

/**
 * The documents the backend of the application keeps in a database of its own (its settings, its
 * favorites): the same for every browser that opens it. A page starts from the defaults, takes
 * what was saved once it is read, and saves what changes a moment later. The pages of the same
 * browser follow one another at once, the other browsers when they come back into view.
 */

const SAVE_DELAY_MS = 400;

export interface DocumentOptions<T> {
  /** What was saved (null when nothing was) turned into a valid value, the defaults where not. */
  parse: (saved: unknown) => T;
  /** The address of a path of the backend: the application may be served under a prefix. */
  url?: (path: string) => string;
  /** Where this browser kept the value before: carried over once, when nothing was saved yet. */
  legacyKey?: string;
}

export interface StoredDocument<T> {
  value: Ref<T>;
  /** Reads what was saved; until it has, nothing is written. */
  load: () => Promise<void>;
}

export function storedDocument<T>(
  name: string,
  { parse, url = (path) => path, legacyKey }: DocumentOptions<T>,
): StoredDocument<T> {
  const address = url(`api/documents/${name}`);
  const value = ref(parse(null)) as Ref<T>;
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(address);
  // What was last saved or read, as JSON: null until the saved document has been read.
  let saved: string | null = null;
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listening = false;

  function show(stored: unknown) {
    value.value = parse(stored);
    saved = JSON.stringify(value.value);
  }

  async function write(text: string, keepalive = false) {
    try {
      await fetch(address, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: text,
        keepalive,
      });
    } catch {
      // The page keeps the change: the next one saves it with the rest.
    }
  }

  function flush(keepalive = false) {
    clearTimeout(timer);
    if (pending !== null) {
      void write(pending, keepalive);
      pending = null;
    }
  }

  function adoptLegacy(): boolean {
    try {
      const text = legacyKey ? localStorage.getItem(legacyKey) : null;
      if (text === null) {
        return false;
      }
      localStorage.removeItem(legacyKey!);
      // Saved as it is read: what differs from the last saved JSON is written.
      saved = '';
      value.value = parse(JSON.parse(text));
      return true;
    } catch {
      return false;
    }
  }

  function listen() {
    if (listening || typeof document === 'undefined') {
      return;
    }
    listening = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void load();
      } else {
        flush(true);
      }
    });
    window.addEventListener('pagehide', () => flush(true));
  }

  async function load() {
    listen();
    // What this page is about to save is newer than what the backend holds.
    if (pending !== null) {
      return;
    }
    try {
      const response = await fetch(address, { cache: 'no-store' });
      if (!response.ok) {
        return;
      }
      const stored: unknown = await response.json();
      if (stored !== null || !adoptLegacy()) {
        show(stored);
      }
    } catch {
      // Without the backend the page keeps the defaults, and saves nothing over the document.
    }
  }

  if (channel) {
    channel.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (typeof data === 'string') {
        show(JSON.parse(data));
      }
    };
  }

  watch(
    value,
    (current) => {
      const text = JSON.stringify(current);
      if (saved === null || text === saved) {
        return;
      }
      saved = text;
      pending = text;
      channel?.postMessage(text);
      clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DELAY_MS);
    },
    { deep: true },
  );

  return { value, load };
}
