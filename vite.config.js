import { defineConfig } from 'vite';

// Dev stays at '/', production builds under '/crime-data-viz/' so assets resolve on
// GitHub Pages (https://jonxpill.github.io/crime-data-viz/). The data fetch is relative
// ('data/capetown.json'), so it rides the base path automatically.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/crime-data-viz/' : '/',
}));
