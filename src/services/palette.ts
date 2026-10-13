import type { PaletteRole } from '../types/launcher';
import { isRecord } from './protocol';

export const paletteTokens: Record<PaletteRole, string> = {
  background: '--nas-background',
  foreground: '--nas-foreground',
  surface: '--nas-surface',
  sunken: '--nas-sunken',
  hover: '--nas-hover',
  border: '--nas-border',
  muted: '--nas-muted',
};

export function applyNasColor(root: HTMLElement, token: string, value: unknown): void {
  if (typeof value === 'string' && root.ownerDocument.defaultView?.CSS?.supports('color', value)) {
    root.style.setProperty(token, value);
  } else {
    root.style.removeProperty(token);
  }
}

export function applyNasPalette(palette: unknown, root?: HTMLElement): void {
  const element = root ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  if (!element) {
    return;
  }
  const colors = isRecord(palette) ? palette : {};
  for (const [role, token] of Object.entries(paletteTokens)) {
    applyNasColor(element, token, colors[role]);
  }
}
