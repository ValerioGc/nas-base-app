import { spawnTool } from '../process-tools.mjs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { backendPackage } from '../backend-paths.mjs';

export function startBackend({ root = process.cwd(), socket, uiDir, cargo, env = {} } = {}) {
  const { app } = JSON.parse(readFileSync(join(root, 'nas-app.json'), 'utf8'));
  socket ??= process.env.NAS_APP_SOCKET ?? join(tmpdir(), `${app.id}-dev.sock`);

  return spawnTool(
    'cargo',
    ['run', '--manifest-path', cargo ?? backendPackage(root), '--', '--listen', socket],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env,
        NAS_UI_DIR: uiDir ?? env.NAS_UI_DIR ?? process.env.NAS_UI_DIR ?? 'dist/axum',
      },
    },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const child = startBackend();
  const handlers = ['SIGINT', 'SIGTERM'].map((signal) => {
    const forward = () => child.kill(signal);
    process.on(signal, forward);
    return [signal, forward];
  });
  const cleanup = () => handlers.forEach(([signal, handler]) => process.off(signal, handler));

  child.on('error', (error) => {
    cleanup();
    console.error(error.message);
    process.exitCode = 1;
  });

  child.on('exit', (code) => {
    cleanup();
    process.exitCode = code ?? 1;
  });
}
