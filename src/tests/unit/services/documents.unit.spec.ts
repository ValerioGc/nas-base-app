import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { storedDocument } from '../../../services/documents';

interface Settings {
  size: number;
}

const parse = (saved: unknown): Settings => ({
  size:
    saved && typeof saved === 'object' && 'size' in saved && typeof saved.size === 'number'
      ? saved.size
      : 1,
});

let documents = 0;
const named = () => `test-${++documents}`;

function backend(saved: unknown = null) {
  let stored = saved === null ? null : JSON.stringify(saved);
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      stored = String(init.body);
      return new Response(null, { status: 204 });
    }
    return new Response(stored ?? 'null', { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  const writes = () => fetch.mock.calls.filter(([, init]) => init?.method === 'PUT');
  const save = (value: unknown) => (stored = JSON.stringify(value));
  return { fetch, writes, save, stored: () => stored };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  setVisibility('visible');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a stored document', () => {
  it('starts from the defaults, takes what was saved and saves each change a moment later', async () => {
    const server = backend({ size: 3 });
    const name = named();
    const settings = storedDocument(name, { parse, url: (path) => `/prefix/${path}` });
    expect(settings.value.value).toEqual({ size: 1 });

    await settings.load();
    expect(server.fetch).toHaveBeenCalledWith(`/prefix/api/documents/${name}`, {
      cache: 'no-store',
    });
    expect(settings.value.value).toEqual({ size: 3 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.writes()).toEqual([]);

    settings.value.value.size = 4;
    await nextTick();
    settings.value.value = { size: 5 };
    await nextTick();
    expect(server.writes()).toEqual([]);
    await vi.advanceTimersByTimeAsync(400);
    expect(server.writes()).toHaveLength(1);
    expect(server.stored()).toBe('{"size":5}');

    settings.value.value = { size: 5 };
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);
    expect(server.writes()).toHaveLength(1);
  });

  it('writes nothing over the document until it has been read', async () => {
    const server = backend({ size: 3 });
    server.fetch.mockRejectedValueOnce(new Error('offline'));
    const settings = storedDocument(named(), { parse });
    await settings.load();
    settings.value.value = { size: 9 };
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);
    expect(server.writes()).toEqual([]);

    server.fetch.mockResolvedValueOnce(new Response('busy', { status: 503 }));
    await settings.load();
    expect(settings.value.value).toEqual({ size: 9 });
    await settings.load();
    expect(settings.value.value).toEqual({ size: 3 });
  });

  it('starts from the defaults when nothing was saved, and saves nothing until a change', async () => {
    const server = backend();
    const settings = storedDocument(named(), { parse, legacyKey: 'old-settings' });
    await settings.load();
    expect(settings.value.value).toEqual({ size: 1 });
    await vi.advanceTimersByTimeAsync(400);
    expect(server.writes()).toEqual([]);
  });

  it('carries over once what this browser kept before', async () => {
    localStorage.setItem('old-settings', '{"size":7}');
    const server = backend();
    const settings = storedDocument(named(), { parse, legacyKey: 'old-settings' });
    await settings.load();
    expect(settings.value.value).toEqual({ size: 7 });
    expect(localStorage.getItem('old-settings')).toBeNull();
    await vi.advanceTimersByTimeAsync(400);
    expect(server.stored()).toBe('{"size":7}');
  });

  it('ignores what this browser kept before when it is not readable', async () => {
    localStorage.setItem('old-settings', '{');
    backend();
    const settings = storedDocument(named(), { parse, legacyKey: 'old-settings' });
    await settings.load();
    expect(settings.value.value).toEqual({ size: 1 });
  });

  it('keeps a change the backend did not take, and saves it with the next one', async () => {
    const server = backend();
    const settings = storedDocument(named(), { parse });
    await settings.load();
    server.fetch.mockRejectedValueOnce(new Error('offline'));
    settings.value.value = { size: 2 };
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);
    expect(server.stored()).toBeNull();
    settings.value.value = { size: 6 };
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);
    expect(server.stored()).toBe('{"size":6}');
  });

  it('saves at once when the page goes out of view, and reads again when it comes back', async () => {
    const server = backend({ size: 2 });
    const settings = storedDocument(named(), { parse });
    await settings.load();
    settings.value.value = { size: 8 };
    await nextTick();

    await settings.load();
    expect(settings.value.value).toEqual({ size: 8 });

    setVisibility('hidden');
    expect(server.writes()).toHaveLength(1);
    expect(server.writes()[0]![1]).toEqual(expect.objectContaining({ keepalive: true }));
    window.dispatchEvent(new Event('pagehide'));
    expect(server.writes()).toHaveLength(1);

    server.save({ size: 11 });
    setVisibility('visible');
    await vi.waitFor(() => expect(settings.value.value).toEqual({ size: 11 }));
  });

  it('follows at once what another page of this browser changes', async () => {
    vi.useRealTimers();
    backend({ size: 2 });
    const name = named();
    const app = storedDocument(name, { parse });
    const widget = storedDocument(name, { parse });
    await Promise.all([app.load(), widget.load()]);
    app.value.value = { size: 12 };
    await vi.waitFor(() => expect(widget.value.value).toEqual({ size: 12 }));
  });
});
