import { describe, expect, it } from 'vitest';
import { randomUuid } from '../../../services/randomUuid';

describe('random UUIDs', () => {
  it('generates distinct UUID v4 identifiers without crypto.randomUUID', () => {
    const source = { getRandomValues: window.crypto.getRandomValues.bind(window.crypto) };
    const ids = Array.from({ length: 100 }, () => randomUuid(source));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    }
  });

  it('uses browser crypto by default', () => {
    expect(randomUuid()).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
  });
});
