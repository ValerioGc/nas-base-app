import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Most apps have an Axum crate in a workspace; Picture has its crate at backend/. */
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
