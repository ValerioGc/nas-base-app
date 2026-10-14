import { cpSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'copy-library-styles',
      apply: 'build',
      closeBundle() {
        cpSync(
          fileURLToPath(new URL('./src/styles', import.meta.url)),
          fileURLToPath(new URL('./dist/styles', import.meta.url)),
          {
            recursive: true,
            filter: (path) => extname(path) === '' || extname(path) === '.scss',
          },
        );
      },
    },
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'nas-base-app',
    },
    rolldownOptions: { external: ['vue'] },
  },
});
