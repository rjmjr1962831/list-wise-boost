#!/usr/bin/env node
/**
 * audit-business-config.cjs
 *
 * Scans the codebase for hardcoded business constants and reports where they appear.
 * Uses businessConfig.json as the single source of truth.
 *
 * Usage:
 *   node scripts/audit-business-config.cjs           # full report
 *   node scripts/audit-business-config.cjs --brief   # counts only
 *   node scripts/audit-business-config.cjs --check   # exit 1 if deprecated values found
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/businessConfig.json'), 'utf8'));

const brief = process.argv.includes('--brief');
const check = process.argv.includes('--check');

// Directories to scan — must include ALL public/ subdirs with deployable content
const SCAN_DIRS = [
  'src',
  'supabase/functions',
  'public',
];
// Extensions to scan
const EXTENSIONS = '*.ts *.tsx *.js *.jsx *.json *.md *.html *.txt';
// Directories/files to skip
const EXCLUDES = [
  ':!node_modules',
  ':!dist',
  ':!.claude',
  ':!archives',
  ':!src/data/businessConfig.json',
  ':!scripts/audit-business-config.cjs',
  ':!public/coverage.json',
  ':!supabase/functions/site-health-check/index.ts',
];

function gitGrep(pattern) {
  const paths = SCAN_DIRS.filter(d => fs.existsSync(path.join(ROOT, d)));
  if (!paths.length) return '';
  const cmd = `git -C "${ROOT}" grep -n -E "${pattern}" -- ${paths.map(p => `"${p}"`).join(' ')} ${EXCLUDES.map(e => `"${e}"`).join(' ')}`;
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    return e.stdout || '';
  }
}

function gitGrepFiles(pattern) {
  const paths = SCAN_DIRS.filter(d => fs.existsSync(path.join(ROOT, d)));
  if (!paths.length) return [];
  const cmd = `git -C "${ROOT}" grep -l -E "${pattern}" -- ${paths.map(p => `"${p}"`).join(' ')} ${EXCLUDES.map(e => `"${e}"`).join(' ')}`;
  try {
    const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// Define what to audit
const audits = [
  {
    label: `Merit Gate: rating (${config.meritGate.rating}+)`,
    pattern: `4\\.5.{0,10}(star|rating|Stars|Rating)|(star|rating|Stars|Rating).{0,10}4\\.5`,
    configValue: config.meritGate.rating,
  },
  {
    label: `Merit Gate: reviews (${config.meritGate.reviews}+)`,
    pattern: `\\b10\\+?.{0,10}(verified|review|Review)|(review|Review).{0,10}\\b10\\b`,
    configValue: config.meritGate.reviews,
  },
  {
    label: `Merit Gate: window (${config.meritGate.windowMonths} months)`,
    pattern: `24.{0,5}(month|Month)`,
    configValue: config.meritGate.windowMonths,
  },
  {
    label: `Merit Gate: experience (${config.meritGate.yearsExperience}+ years)`,
    pattern: `\\b5\\+?.{0,5}(year|Year|yr).{0,10}(experience|Experience|business|Business)`,
    configValue: config.meritGate.yearsExperience,
  },
  {
    label: `Pricing: Audited ($${config.pricing.audited}/mo)`,
    pattern: `\\$?300.{0,5}(/mo|per month|month)`,
    configValue: `$${config.pricing.audited}`,
  },
  {
    label: `Pricing: Underwritten ($${config.pricing.underwritten}/mo)`,
    pattern: `\\$?500.{0,5}(/mo|per month|month)`,
    configValue: `$${config.pricing.underwritten}`,
  },
  {
    label: 'Coverage language',
    pattern: `fewer than 1%|less than 1%`,
    configValue: config.coverage.label,
  },
];

const deprecatedAudits = [
  {
    label: 'DEPRECATED: "top 0.5%" coverage language',
    pattern: `top 0\\.5%`,
    severity: 'error',
  },
  {
    label: 'DEPRECATED: "top 0.2%" coverage language',
    pattern: `top 0\\.2%`,
    severity: 'error',
  },
  {
    label: 'DEPRECATED: old Audited pricing ($100/mo)',
    pattern: `\\$100.{0,5}/mo.{0,20}(audit|tier|subscription|plan)|(audit|Audit).{0,20}\\$100`,
    severity: 'error',
  },
  {
    label: 'DEPRECATED: old Underwritten pricing ($150/mo)',
    pattern: `\\$150.{0,5}/mo.{0,20}(underwr|tier|subscription|plan)|(underwr|Underwr).{0,20}\\$150`,
    severity: 'error',
  },
  {
    label: 'DEPRECATED: old merit gate "4.8" as qualification',
    pattern: `4\\.8.{0,10}(qualification|qualif|gate|minimum|merit|require)|(minimum|gate|qualif|merit|require).{0,10}4\\.8`,
    severity: 'error',
  },
  {
    label: 'DEPRECATED: old merit gate "20+ reviews" as qualification',
    pattern: `\\b20\\+?.{0,10}(verified|review).{0,10}(qualif|gate|minimum|require)`,
    severity: 'error',
  },
];

console.log('='.repeat(70));
console.log('BUSINESS CONFIG AUDIT');
console.log(`Source of truth: src/data/businessConfig.json`);
console.log('='.repeat(70));
console.log('');

// Active values
console.log('--- ACTIVE VALUES ---');
console.log('');

let totalFiles = 0;
for (const audit of audits) {
  const files = gitGrepFiles(audit.pattern);
  totalFiles += files.length;
  console.log(`${audit.label}`);
  console.log(`  Config value: ${audit.configValue}`);
  console.log(`  Found in: ${files.length} files`);

  if (!brief && files.length > 0) {
    for (const f of files) {
      const rel = f.replace(/\\/g, '/');
      console.log(`    ${rel}`);
    }
  }
  console.log('');
}

console.log(`Total: ${totalFiles} file occurrences across ${audits.length} patterns`);
console.log('');

// Deprecated values
console.log('--- DEPRECATED VALUES (should not exist) ---');
console.log('');

let deprecatedCount = 0;
for (const audit of deprecatedAudits) {
  const files = gitGrepFiles(audit.pattern);
  if (files.length > 0) {
    deprecatedCount += files.length;
    console.log(`!! ${audit.label}`);
    console.log(`  Found in: ${files.length} files`);
    if (!brief) {
      const matches = gitGrep(audit.pattern);
      const lines = matches.trim().split('\n').filter(Boolean).slice(0, 20);
      for (const line of lines) {
        console.log(`    ${line}`);
      }
      if (matches.trim().split('\n').filter(Boolean).length > 20) {
        console.log(`    ... and more`);
      }
    }
    console.log('');
  }
}

if (deprecatedCount === 0) {
  console.log('None found. Clean.');
} else {
  console.log(`\n${deprecatedCount} files contain deprecated values.`);
}

console.log('');
console.log('='.repeat(70));

if (check && deprecatedCount > 0) {
  console.log('FAIL: Deprecated values found.');
  process.exit(1);
} else {
  console.log('Done.');
}
