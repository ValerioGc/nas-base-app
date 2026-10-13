import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyNasColor, applyNasPalette, paletteTokens } from '../../../services/palette';

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('style');
});

describe('NAS palette', () => {
  it('sets supported colors and clears invalid, absent or non-string colors', () => {
    vi.stubGlobal('CSS', { supports: (_property: string, color: string) => color === '#123456' });
    const root = document.createElement('div');
    applyNasPalette({ surface: '#123456', border: 'invalid', hover: 42 }, root);
    expect(root.style.getPropertyValue(paletteTokens.surface)).toBe('#123456');
    expect(root.style.getPropertyValue(paletteTokens.border)).toBe('');
    applyNasPalette(null, root);
    expect(root.style.getPropertyValue(paletteTokens.surface)).toBe('');
  });

  it('defaults to the document root and removes stale colors when CSS support is unavailable', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    applyNasPalette({ background: '#123456' });
    expect(document.documentElement.style.getPropertyValue(paletteTokens.background)).toBe(
      '#123456',
    );
    vi.stubGlobal('CSS', undefined);
    applyNasPalette({ background: '#123456' });
    expect(document.documentElement.style.getPropertyValue(paletteTokens.background)).toBe('');
  });

  it('supports server-side calls and documents without a browsing context', () => {
    const detached = document.implementation.createHTMLDocument();
    detached.documentElement.style.setProperty('--accent', 'red');
    applyNasColor(detached.documentElement, '--accent', 'blue');
    expect(detached.documentElement.style.getPropertyValue('--accent')).toBe('');
    vi.stubGlobal('document', undefined);
    expect(() => applyNasPalette({ surface: 'red' })).not.toThrow();
  });
});
