/**
 * post-build.mjs
 * Runs after vite build to set up static homepage.
 * 
 * Problem: Vite overwrites public/index.html with SPA entry point.
 * Solution: Save SPA entry as _spa.html, put pre-rendered homepage at index.html.
 * Vercel catch-all rewrite points to /_spa.html for client-side routes.
 */
import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const dist = 'dist';
const spaEntry = join(dist, 'index.html');
const spaTarget = join(dist, '_spa.html');
const staticHome = join(dist, '_home.html');

// 1. Save SPA entry
if (existsSync(spaEntry)) {
  copyFileSync(spaEntry, spaTarget);
  console.log('[post-build] Saved SPA entry -> _spa.html');
}

// 2. Replace with static homepage
if (existsSync(staticHome)) {
  copyFileSync(staticHome, spaEntry);
  console.log('[post-build] Static homepage -> index.html');
} else {
  console.warn('[post-build] WARNING: _home.html not found, homepage will be SPA shell');
}
