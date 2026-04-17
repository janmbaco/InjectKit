import { defineConfig } from 'tsup';

const browserConfig = {
  bundle: true,
  clean: false,
  dts: false,
  entry: {
    injectkit: 'dist/index.js',
  },
  format: ['esm'],
  outDir: 'dist/browser',
  platform: 'browser',
  sourcemap: true,
  splitting: false,
  target: 'es2020',
} as const;

export default defineConfig([
  browserConfig,
  {
    ...browserConfig,
    minify: true,
    outExtension: () => ({
      js: '.min.js',
    }),
  },
]);
