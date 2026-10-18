import { vi } from 'vitest';
import { createNasShell } from '../../services/nasShell';
import { isRecord } from '../../services/protocol';

export function shellFixture(
  timeoutMs = 10000,
  source: Pick<Crypto, 'getRandomValues'> = window.crypto,
  shellOrigin = 'https://nas.test',
) {
  const target = new EventTarget();
  const post = vi.fn<(message: unknown, origin: string) => void>();
  const parent = { postMessage: post } as unknown as Window;
  const add = vi.fn(target.addEventListener.bind(target));
  const remove = vi.fn(target.removeEventListener.bind(target));
  const view = {
    parent,
    location: { origin: shellOrigin },
    crypto: source,
    addEventListener: add,
    removeEventListener: remove,
  } as unknown as Window;

  const shell = createNasShell({ view, timeoutMs });
  function receive(data: unknown, origin = shellOrigin, source = parent) {
    target.dispatchEvent(new MessageEvent('message', { data, origin, source }));
  }

  function lastRequest() {
    const message = post.mock.calls.at(-1)?.[0];
    if (!isRecord(message) || typeof message.requestId !== 'string') {
      throw new Error('No outgoing request');
    }
    return message.requestId;
  }

  return { shell, post, receive, lastRequest, add, remove, parent };
}

export const contextMessage = {
  nas: 1,
  type: 'context',
  context: {
    app: 'sample',
    theme: 'dark',
    accent: '#123456',
    locale: 'en',
    palette: { surface: '#202020' },
  },
} as const;
