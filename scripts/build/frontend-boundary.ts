import type { Plugin } from 'vite';

/**
 * Ensures that the NAS frontend does not import native modules based on the target environment.
 * @param target The target environment, either 'axum' or 'tauri'.
 * @returns {Plugin} Vite plugin that enforces the frontend boundary.
 */
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
