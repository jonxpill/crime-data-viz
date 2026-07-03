import { defineConfig } from 'vite';

// Dev at '/', hosted build under '/crime-data-viz/' so assets resolve on GitHub Pages
// (https://jonxpill.github.io/crime-data-viz/). Data fetches are relative, so they ride the base path.
//
// ONE entry: index.html → the Western Cape explorer (src/wcExplore.js) — the whole app. (The standalone
// Cape Town page + src/main.js were retired once the explorer's Cape Town region became a full superset;
// they live in git history.)
//
// Single-file share: `npm run build:single` sets SINGLE=1, which forces the whole app into ONE inlinable
// JS bundle (no code-split) so pipeline/build-single.mjs can embed it + the data into one offline .html.
const single = process.env.SINGLE === '1';
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/crime-data-viz/' : '/',
  build: single
    ? { rollupOptions: { output: { inlineDynamicImports: true, manualChunks: undefined } } }
    : {},
}));
