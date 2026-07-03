import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Dev stays at '/', production builds under '/crime-data-viz/' so assets resolve on
// GitHub Pages (https://jonxpill.github.io/crime-data-viz/). The data fetch is relative
// ('data/capetown.json'), so it rides the base path automatically.
//
// Multi-page build: index.html (Cape Town, the deployed app) stays the primary entry —
// unchanged behaviour/output. wcExplore.html (the standalone Western Cape explorer) is
// added as a second entry so `npm run build` compiles it too. wc.html (the WC→Cape-Town
// drill-down spike) is intentionally left OUT of the build list — untouched, dev-server-only.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/crime-data-viz/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        wcExplore: resolve(__dirname, 'wcExplore.html'),
      },
    },
  },
}));
