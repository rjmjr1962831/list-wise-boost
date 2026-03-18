/**
 * guard-stale-html.mjs
 * Build-time guard: fails the build if stale static HTML exists in public/
 * for paths that should be served exclusively by edge functions.
 *
 * Run as part of the build pipeline (prebuild or post-build).
 * Exit 1 = stale HTML found (fail the build).
 * Exit 0 = all clear.
 */
import { readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const ROOT = 'public';
const violations = [];

// Directories that must NOT contain SEO/agent HTML pages.
// Edge functions own these paths entirely.
const GUARDED_DIRS = [
  'public/arizona',
  'public/california',
  'public/clean-room',
];

// Filename patterns that indicate a stale SEO page
const STALE_PATTERNS = [
  /top10realestateagents\.html$/i,
  /best-real-estate-agents/i,
  /best-realtors/i,
  /top-real-estate-agents/i,
];

// Allowlist: state index pages are fine (they don't conflict with rewrites)
const ALLOWED = new Set([
  'public/arizona/index.html',
  'public/california/index.html',
  'public/colorado/index.html',
  'public/florida/index.html',
  'public/new-york/index.html',
  'public/texas/index.html',
]);

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const rel = full.replace(/\\/g, '/');
      if (ALLOWED.has(rel)) continue;
      violations.push(rel);
    }
  }
}

// Check guarded directories for ANY html files (except allowlist)
for (const dir of GUARDED_DIRS) {
  if (dir === 'public/arizona' || dir === 'public/california') {
    // For state dirs, only flag HTML files in subdirectories (city/neighborhood pages)
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name));
      }
    }
  } else {
    walk(dir);
  }
}

if (violations.length > 0) {
  console.error('\n[guard-stale-html] FATAL: Stale static HTML found in guarded directories!\n');
  console.error('These files will override edge function rewrites and serve stale data to AI crawlers.\n');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  console.error(`\nTotal: ${violations.length} file(s). Delete them before deploying.\n`);
  process.exit(1);
} else {
  console.log('[guard-stale-html] OK: No stale HTML in guarded directories.');
}
