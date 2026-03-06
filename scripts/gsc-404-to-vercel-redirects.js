#!/usr/bin/env node
/**
 * GSC 404 URL list → Vercel redirect entries
 *
 * Usage:
 *   node scripts/gsc-404-to-vercel-redirects.js [file.txt]
 *   cat gsc-404-export.csv | node scripts/gsc-404-to-vercel-redirects.js
 *
 * Input: one URL per line (full URL or path). Lines starting with # are skipped.
 * If the line looks like CSV, the first column is used (so GSC "Page URL" export works).
 *
 * Output: JSON array of redirect objects to merge into vercel.json "redirects":
 *   { "source": "/path", "destination": "/404", "permanent": false }
 *
 * To add custom redirects (old → new), use a line with two comma-separated values:
 *   /old/path,/new/path
 *   https://www.top10lists.us/old,/california/top10realestateagents
 */

const readline = require('readline');
const fs = require('fs');

function toPath(line) {
  const raw = (line || '').trim();
  if (!raw || raw.startsWith('#')) return null;
  // CSV: use first column
  const first = raw.split(',')[0].trim();
  try {
    if (first.startsWith('http://') || first.startsWith('https://')) {
      const u = new URL(first);
      return u.pathname || '/';
    }
    return first.startsWith('/') ? first : `/${first}`;
  } catch {
    return first.startsWith('/') ? first : `/${first}`;
  }
}

function parseLine(line) {
  const raw = (line || '').trim();
  if (!raw || raw.startsWith('#')) return null;
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const from = toPath(parts[0]);
    const to = parts[1].startsWith('/') ? parts[1] : toPath(parts[1]) || '/404';
    return { source: from, destination: to, permanent: false };
  }
  const path = toPath(raw);
  if (!path) return null;
  return { source: path, destination: '/404', permanent: false };
}

async function main() {
  const inputPath = process.argv[2];
  const lines = [];
  if (inputPath) {
    const content = fs.readFileSync(inputPath, 'utf8');
    lines.push(...content.split(/\r?\n/));
  } else {
    const rl = readline.createInterface({ input: process.stdin });
    for await (const line of rl) lines.push(line);
  }
  const redirects = [];
  for (const line of lines) {
    const r = parseLine(line);
    if (r) redirects.push(r);
  }
  console.log(JSON.stringify(redirects, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
