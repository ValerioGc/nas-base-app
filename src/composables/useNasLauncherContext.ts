import { onMounted, onUnmounted, readonly, ref, shallowRef } from 'vue';
import { createNasShell } from '../services/nasShell';
import { applyNasColor, applyNasPalette, paletteTokens } from '../services/palette';
import type { AppContext, NasContextOptions, NasLocale, NasTheme } from '../types/launcher';

/**
 * Composable function to create and manage the launcher context for a NAS application.
 * @param options NasContextOptions used to configure the launcher context.
 * @returns An object containing the launcher context, including shell, locale, theme, context, and active state.
 */
export function useNasLauncherContext(options: NasContextOptions = {}) {
  const shell = options.shell ?? createNasShell();
  const locale = ref<NasLocale>(options.locale ?? 'it');
  const theme = ref<NasTheme>(options.theme ?? 'light');
  const context = shallowRef<AppContext | null>(null);
  const active = ref(false);

  let stop: (() => void) | undefined;
  let root: HTMLElement | null;
  let restore: (() => void) | undefined;

  function changeLocale(value: string | null): void {
    if (value === 'en' || value === 'it') {
      locale.value = value;
      options.onLocaleChange?.(value);
    }
  }

  onMounted(() => {
    const defaultRoot = typeof document === 'undefined' ? null : document.documentElement;
    root = options.root === undefined ? defaultRoot : options.root;
    if (root) {
      const element = root;
      const attributes = ['data-theme', 'data-nas-shell'];
      const tokens = ['--accent', ...Object.values(paletteTokens)];
      const savedAttributes = attributes.map((key) => [key, element.getAttribute(key)] as const);
      const savedTokens = tokens.map(
        (key) =>
          [
            key,
            element.style.getPropertyValue(key),
            element.style.getPropertyPriority(key),
          ] as const,
      );

      restore = () => {
        for (const [key, value] of savedAttributes) {
          if (value === null) {
            element.removeAttribute(key);
          } else {
            element.setAttribute(key, value);
          }
        }
        for (const [key, value, priority] of savedTokens) {
          if (value) {
            element.style.setProperty(key, value, priority);
          } else {
            element.style.removeProperty(key);
          }
        }
      };

      const url = new URL(element.ownerDocument.location.href);
      changeLocale(url.searchParams.get('lang'));
      const initialTheme = url.searchParams.get('theme');
      if (initialTheme === 'dark' || initialTheme === 'light') {
        theme.value = initialTheme;
      }
      
      element.dataset.theme = theme.value;
    }

    stop = shell.listen((message) => {
      if (message.type !== 'context') {
        return;
      }

      context.value = message.context;
      active.value = true;
      theme.value = message.context.theme;
      changeLocale(message.context.locale);
      if (root) {
        root.dataset.nasShell = 'true';
        root.dataset.theme = theme.value;
      }

      if (root) {
        applyNasColor(root, '--accent', message.context.accent);
        applyNasPalette(message.context.palette, root);
      }
    });

    shell.ready();
  });

  onUnmounted(() => {
    stop?.();
    if (!options.shell) {
      shell.dispose();
    }
    
    restore?.();
    active.value = false;
    context.value = null;
  });

  return {
    shell,
    locale: readonly(locale),
    theme: readonly(theme),
    context: readonly(context),
    active: readonly(active),
  };
}
