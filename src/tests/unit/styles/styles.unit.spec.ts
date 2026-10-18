import { compile } from 'sass';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const stylesheet = compile(resolve('src/styles/main.scss')).css;
const root = document.documentElement;
const savedTheme = root.getAttribute('data-theme');
const savedShell = root.getAttribute('data-nas-shell');
const savedStyle = root.getAttribute('style');
let style: HTMLStyleElement;
let surface: HTMLDivElement;

beforeEach(() => {
  root.removeAttribute('data-theme');
  root.removeAttribute('data-nas-shell');
  root.removeAttribute('style');
  style = document.createElement('style');
  style.textContent = stylesheet;
  document.head.append(style);
  surface = document.createElement('div');
  surface.className = 'app_surface';
  document.body.append(surface);
});

afterEach(() => {
  style.remove();
  surface.remove();
  for (const [name, value] of [
    ['data-theme', savedTheme],
    ['data-nas-shell', savedShell],
    ['style', savedStyle],
  ] as const) {
    if (value === null) {
      root.removeAttribute(name);
    } else {
      root.setAttribute(name, value);
    }
  }
});

describe('shared NAS styles', () => {
  it('supplies the existing light and dark app palettes', () => {
    expect(getComputedStyle(root).getPropertyValue('--nas-surface').trim()).toBe('#ffffff');
    root.dataset.theme = 'dark';
    expect(getComputedStyle(root).getPropertyValue('--nas-surface').trim()).toBe('#131f29');
    expect(getComputedStyle(root).getPropertyValue('--nas-foreground').trim()).toBe('#f2f7f5');
  });

  it('lets launcher overrides win and restores defaults when they are removed', () => {
    root.dataset.theme = 'dark';
    root.dataset.nasShell = 'true';
    root.style.setProperty('--nas-surface', '#123456');
    expect(getComputedStyle(root).getPropertyValue('--nas-surface').trim()).toBe('#123456');
    expect(getComputedStyle(document.body).colorScheme).toBe('dark');
    root.style.removeProperty('--nas-surface');
    expect(getComputedStyle(root).getPropertyValue('--nas-surface').trim()).toBe('#131f29');
  });

  it('styles layout, buttons, panels and fields using classes alone', () => {
    surface.innerHTML =
      '<main class="app_content"><section class="app_panel page_panel"><label class="app_field">Name<input /></label><button class="app_button app_button--primary" disabled>Save</button></section></main>';
    expect(getComputedStyle(surface).display).toBe('grid');
    const button = surface.querySelector('button');
    const field = surface.querySelector('label');
    const panel = surface.querySelector('section');
    if (!button || !field || !panel) {
      throw new Error('Missing fixture controls');
    }
    expect(getComputedStyle(button).display).toBe('inline-flex');
    expect(getComputedStyle(button).opacity).toBe('0.55');
    expect(getComputedStyle(field).display).toBe('grid');
    expect(getComputedStyle(panel).borderRadius).toBe('0.75rem');
  });

  it('keeps SVG masks free of image filters in primary buttons', () => {
    surface.innerHTML =
      '<button class="app_button app_button--primary"><span class="app_icon app_icon_mask"></span></button>';
    const icon = surface.querySelector('span');
    if (!icon) {
      throw new Error('Missing icon');
    }
    expect(getComputedStyle(icon).filter).toBe('none');
  });

  it('keeps the helper entry free of global CSS rules', () => {
    expect(compile(resolve('src/styles/global.scss')).css).toBe('');
  });

  it('shows only the thumb of the scrollbar, leaving the standard one to Firefox', () => {
    const scrollbar = compile(resolve('src/styles/_nas-scrollbar.scss')).css;
    const supports = scrollbar.indexOf('@supports not selector(::-webkit-scrollbar)');
    const closed = scrollbar.indexOf('}\n}', supports);
    expect(supports).toBeGreaterThanOrEqual(0);
    for (const standard of [
      'scrollbar-width: thin',
      'scrollbar-color: var(--border) transparent',
    ]) {
      const at = scrollbar.indexOf(standard);
      expect(at).toBeGreaterThan(supports);
      expect(at).toBeLessThan(closed);
    }
    expect(scrollbar).toMatch(/::-webkit-scrollbar-button \{\s*display: none;/);
    expect(scrollbar).toMatch(
      /::-webkit-scrollbar-track,\s*\*::-webkit-scrollbar-corner \{\s*background: transparent;/,
    );
    expect(scrollbar).toMatch(/::-webkit-scrollbar-thumb \{[^}]*background: var\(--border\)/);
  });
});
