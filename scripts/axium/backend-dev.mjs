// Script to start the NAS backend in development mode.

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backendPackage } from './backend-paths.mjs';
import { cargoExecutable, isMain, readJson } from '../utils.mjs';

export function startBackend({ root = process.cwd(), socket, uiDir, cargo, env = {} } = {}) {
  const { app } = readJson(join(root, 'nas-app.json'));
  socket ??= process.env.NAS_APP_SOCKET ?? join(tmpdir(), `${app.id}-dev.sock`);

  return spawn(
    cargoExecutable(env),
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

if (isMain(import.meta.url)) {
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
