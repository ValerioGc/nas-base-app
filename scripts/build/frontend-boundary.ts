import type { Plugin } from 'vite';

export function frontendBoundary(target: 'axum' | 'tauri'): Plugin {
  return {
    name: 'nas-frontend-boundary',
    enforce: 'pre',
    load(id) {
      if (target === 'axum' && /[/\\]@tauri-apps[/\\]/.test(id)) {
        throw new Error(`The NAS frontend cannot import native modules: ${id}`);
      }

      return null;
    },
  };
}
