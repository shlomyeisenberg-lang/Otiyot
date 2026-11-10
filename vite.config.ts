import { defineConfig } from 'vitest/config';

// base './' keeps every asset path relative so the same build works on the web and inside Otzaria.
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', sourcemap: false },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
