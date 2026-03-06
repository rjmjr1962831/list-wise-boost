/**
 * post-build.mjs
 * Runs after vite build to set up static homepage.
 *
 * Problem: Vite overwrites public/index.html with SPA entry point.
 * Solution: Save SPA entry as _spa.html, put pre-rendered homepage at index.html.
 * Vercel catch-all rewrite points to /_spa.html for client-side routes.
 *
 * CRITICAL: _home.html has hardcoded asset paths that go stale on every build.
 * We extract the current CSS/JS hashes from the freshly built SPA entry and
 * inject them into _home.html so the homepage always references valid assets.
 */
import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const dist = 'dist';
const spaEntry = join(dist, 'index.html');
const spaTarget = join(dist, '_spa.html');
const staticHome = join(dist, '_home.html');

// 1. Save SPA entry (has correct build hashes)
if (existsSync(spaEntry)) {
  copyFileSync(spaEntry, spaTarget);
  console.log('[post-build] Saved SPA entry -> _spa.html');
}

// 2. Keep index.html as SPA entry (do not replace with static _home.html).
//    Root (/) then serves the live React app (Index.tsx); no stale "constitutionally mandated" copy.
//    _home.html is no longer used so GEO/homepage copy stays in sync with src/pages/Index.tsx.
if (existsSync(staticHome)) {
  console.log('[post-build] Keeping index.html as SPA (homepage = live Index.tsx)');
} else {
  console.log('[post-build] index.html = SPA entry (no _home.html)');
}
