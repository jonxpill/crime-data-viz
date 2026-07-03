/**
 * build-single.mjs — bundle the whole app into ONE self-contained .html file you can share.
 *
 * Run AFTER `vite build` (see the `build:single` npm script). It takes the built dist/ and:
 *   • inlines the JS bundle          (so there's no external <script src> — file:// blocks those)
 *   • embeds capetown.json           (as window.__CAPE_DATA__)
 *   • embeds capetown-dem.bin        (base64 → Int16Array as window.__CAPE_DEM__)
 * so the page fetches NOTHING at runtime and opens by double-click, fully offline.
 *
 * Output: crime-data-viz-standalone.html at the repo root (git-ignored — it's a shareable artifact).
 * loadCapeTown() reads the two globals when present; the normal hosted build ignores them and fetches.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const DIST = ROOT + 'dist/';

// 1. the single built JS bundle
const jsName = readdirSync(DIST + 'assets').find((f) => f.endsWith('.js'));
if (!jsName) throw new Error('no built JS in dist/assets — run `vite build` first');
let js = readFileSync(DIST + 'assets/' + jsName, 'utf8');
js = js.replace(/<\/script>/gi, '<\\/script>'); // don't let a string literal close our inline tag

// 2. the data — every dataset the app loads, keyed by the url loadCapeTown() asks for (+ the Cape Town DEM)
const DATASETS = ['data/westerncape.json', 'data/capetown.json'];
const dataLiteral = '{' + DATASETS.map((u) =>
  JSON.stringify(u) + ':' + readFileSync(ROOT + 'public/' + u, 'utf8').replace(/<\//g, '<\\/'),
).join(',') + '}';
const demB64 = readFileSync(ROOT + 'public/data/capetown-dem.bin').toString('base64');

// 3. the page shell (dist/index.html with its inline HUD + styles), minus the external script tag
let html = readFileSync(DIST + 'index.html', 'utf8').replace(/\s*<script type="module"[^>]*><\/script>/i, '');

// 4. inject: data globals (classic script, runs first) then the inlined app (module script)
const inject = `
    <script>
      window.__CAPE_DATA__ = ${dataLiteral};
      window.__CAPE_DEM__ = (function () {
        var bin = atob("${demB64}"), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return new Int16Array(u.buffer);
      })();
    </script>
    <script type="module">${js}</script>
`;
html = html.replace('</body>', inject + '  </body>');

const OUT = ROOT + 'crime-data-viz-standalone.html';
writeFileSync(OUT, html);
const mb = (Buffer.byteLength(html) / 1e6).toFixed(2);
console.log(`built crime-data-viz-standalone.html (${mb} MB) — double-click to open, fully offline.`);
