import { ref, watch, type Ref } from 'vue';

const SAVE_DELAY_MS = 400;

export interface DocumentOptions<T> {
  parse: (saved: unknown) => T;
  url?: (path: string) => string;
  legacyKey?: string;
}

export interface StoredDocument<T> {
  value: Ref<T>;
  load: () => Promise<void>;
}

export function storedDocument<T>(
  name: string,
  { parse, url = (path) => path, legacyKey }: DocumentOptions<T>,
): StoredDocument<T> {
  const address = url(`api/documents/${name}`);
  const value = ref(parse(null)) as Ref<T>;
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(address);

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
      // Ignore any errors during the write operation.
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
      // Ignore any errors during the load operation.
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
