import { cpSync } from 'node:fs';
import { extname } from 'node:path';

// Preserve relative Sass imports so consumers compile the shared classes themselves.
cpSync('src/styles', 'dist/styles', {
  recursive: true,
  filter: (path) => extname(path) === '' || extname(path) === '.scss',
});
