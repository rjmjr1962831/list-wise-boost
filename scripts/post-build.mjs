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

// 2. Replace with static homepage, injecting current asset hashes
if (existsSync(staticHome)) {
  const spaHtml = readFileSync(spaEntry, 'utf-8');
  let homeHtml = readFileSync(staticHome, 'utf-8');

  // Extract current asset paths from SPA entry
  const cssMatch = spaHtml.match(/\/assets\/index-[^"]*\.css/);
  const jsMatch = spaHtml.match(/\/assets\/index-[^"]*\.js/);

  // Replace old asset paths in _home.html with current ones
  if (cssMatch) {
    homeHtml = homeHtml.replace(/\/assets\/index-[^"]*\.css/, cssMatch[0]);
    console.log(`[post-build] Injected CSS: ${cssMatch[0]}`);
  }
  if (jsMatch) {
    homeHtml = homeHtml.replace(/\/assets\/index-[^"]*\.js/, jsMatch[0]);
    console.log(`[post-build] Injected JS: ${jsMatch[0]}`);
  }

  writeFileSync(spaEntry, homeHtml);
  console.log('[post-build] Static homepage -> index.html (with current asset hashes)');
} else {
  console.warn('[post-build] WARNING: _home.html not found, homepage will be SPA shell');
}
