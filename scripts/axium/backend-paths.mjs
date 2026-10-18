// Utility functions to determine the paths of the NAS backend package and workspace.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function backendPackage(root) {
  return existsSync(resolve(root, 'backend/axum/Cargo.toml')) ||
    !existsSync(resolve(root, 'backend/Cargo.toml'))
    ? 'backend/axum/Cargo.toml'
    : 'backend/Cargo.toml';
}

export function backendWorkspace(root) {
  return existsSync(resolve(root, 'backend/Cargo.toml'))
    ? 'backend/Cargo.toml'
    : backendPackage(root);
}
