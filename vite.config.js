import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Dev at '/', hosted build under '/crime-data-viz/' so assets resolve on GitHub Pages
// (https://jonxpill.github.io/crime-data-viz/). Data fetches are relative, so they ride the base path.
//
// ENTRIES: index.html → the Western Cape explorer (src/wcExplore.js). toll.html → the standalone Toll on
// the shared shell (src/tollMain.js). The multi-page input is added ONLY when NOT building the single-file
// share — `build:single` sets SINGLE=1 → inlineDynamicImports, which Rollup REJECTS with multiple inputs,
// and pipeline/build-single.mjs assumes one assets/*.js bundle. So single stays index-only. (See
// docs/plans/standalone-shell.md §4 blocker 2.)
//
// Single-file share: `npm run build:single` sets SINGLE=1, which forces the whole app into ONE inlinable
// JS bundle (no code-split) so pipeline/build-single.mjs can embed it + the data into one offline .html.
const single = process.env.SINGLE === '1';
const r = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/crime-data-viz/' : '/',
  server: { port: Number(process.env.PORT) || 5173 }, // honour a harness-assigned port (PORT env) when set

  build: single
    ? { rollupOptions: { output: { inlineDynamicImports: true, manualChunks: undefined } } }
    : { rollupOptions: { input: { main: r('index.html'), toll: r('toll.html'), tollGauteng: r('toll-gauteng.html'), tollKzn: r('toll-kzn.html'), tollTriptych: r('toll-triptych.html') } } },
}));
