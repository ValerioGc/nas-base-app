import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'jsdom', include: ['src/tests/unit/**/*.unit.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['src/tests/component/**/*.component.spec.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,vue}', 'scripts/build/**/*.ts'],
      exclude: ['src/tests/**', 'src/types/**', 'src/styles/style.ts', 'src/**/*.d.ts'],
      thresholds: { perFile: true, lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
