/**
 * post-build.mjs
 * Runs after vite build to set up static homepage.
 *
 * Problem: Vite overwrites public/index.html with SPA entry point.
 * Solution: Save SPA entry as _spa.html, put pre-rendered homepage at index.html.
 * Vercel catch-all rewrite points to /_spa.html for client-side routes.
 *
 * IMPORTANT: _home.html has hardcoded asset paths that go stale each build.
 * We must inject the current build's script/link tags from _spa.html so CSS and JS load.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
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

// 2. Replace index.html with static homepage, but inject current asset paths
if (existsSync(staticHome) && existsSync(spaTarget)) {
  const spaHtml = readFileSync(spaTarget, 'utf8');
  let homeHtml = readFileSync(staticHome, 'utf8');

  // Extract script and link from _spa.html (current build's hashed assets)
  const scriptMatch = spaHtml.match(/<script type="module"[^>]*src="(\/assets\/[^"]+)"[^>]*><\/script>/);
  const linkMatch = spaHtml.match(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+)"[^>]*>/);

  if (scriptMatch && linkMatch) {
    const scriptTag = scriptMatch[0];
    const linkTag = linkMatch[0];

    // Replace stale asset refs in _home.html with current build's refs
    homeHtml = homeHtml.replace(
      /<script type="module"[^>]*src="\/assets\/[^"]*"[^>]*><\/script>/,
      scriptTag
    );
    homeHtml = homeHtml.replace(
      /<link rel="stylesheet"[^>]*href="\/assets\/[^"]*"[^>]*>/,
      linkTag
    );
  }

  writeFileSync(spaEntry, homeHtml);
  console.log('[post-build] Static homepage -> index.html (assets injected)');
} else if (existsSync(staticHome)) {
  copyFileSync(staticHome, spaEntry);
  console.log('[post-build] Static homepage -> index.html (no SPA to inject assets from)');
} else {
  console.warn('[post-build] WARNING: _home.html not found, homepage will be SPA shell');
}
