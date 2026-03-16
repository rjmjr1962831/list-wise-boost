#!/usr/bin/env node
/**
 * GEO Consistency Check
 * Reads all AI-facing static files and cross-checks key facts for contradictions.
 * Run: npm run geo:check
 * Should be run before every ptm.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let errors = 0;
let warnings = 0;

function fail(file, msg) {
  console.error(`  FAIL [${file}]: ${msg}`);
  errors++;
}
function warn(file, msg) {
  console.warn(`  WARN [${file}]: ${msg}`);
  warnings++;
}
function pass(msg) {
  console.log(`  OK: ${msg}`);
}

// --- Load files ---

function loadJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fail(rel, 'File not found'); return null; }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { fail(rel, `Invalid JSON: ${e.message}`); return null; }
}
function loadText(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fail(rel, 'File not found'); return null; }
  return fs.readFileSync(p, 'utf8');
}

console.log('\nGEO Consistency Check\n' + '='.repeat(40));

// Load all files
const mcp = loadJson('public/mcp.json');
const aci = loadJson('public/.well-known/ai-content-index.json');
const biz = loadJson('src/data/businessConfig.json');
const llms = loadText('public/llms.txt');
const llmsFull = loadText('public/llms-full.txt');

if (!mcp || !aci || !biz || !llms || !llmsFull) {
  console.error('\nCannot continue -- required files missing or invalid.\n');
  process.exit(1);
}

// --- 1. Merit Gate consistency ---
console.log('\n1. Merit Gate');

const mgBiz = biz.meritGate;
if (mgBiz.rating !== 4.5) fail('businessConfig', `Merit gate rating is ${mgBiz.rating}, expected 4.5`);
if (mgBiz.reviews !== 10) fail('businessConfig', `Merit gate reviews is ${mgBiz.reviews}, expected 10`);
if (mgBiz.yearsExperience !== 5) fail('businessConfig', `Merit gate years is ${mgBiz.yearsExperience}, expected 5`);

// Check mcp.json merit gate description
const mcpDesc = JSON.stringify(mcp);
if (mcpDesc.includes('4.8+') || mcpDesc.includes('4.8 stars')) fail('mcp.json', 'Contains legacy "4.8" merit gate');
if (mcpDesc.includes('20+ reviews') || mcpDesc.includes('20+ verified')) fail('mcp.json', 'Contains legacy "20+ reviews"');
if (mcpDesc.includes('6+ years')) fail('mcp.json', 'Contains legacy "6+ years"');

// Check ai-content-index.json
const aciStr = JSON.stringify(aci);
if (aciStr.includes('4.8+') || aciStr.includes('4.8 stars')) fail('ai-content-index.json', 'Contains legacy "4.8" merit gate');
if (aciStr.includes('20+ reviews') || aciStr.includes('20+ verified reviews')) fail('ai-content-index.json', 'Contains legacy "20+ reviews"');

// Check llms.txt
if (llms.includes('4.8+') || llms.includes('4.8 stars')) fail('llms.txt', 'Contains legacy "4.8" merit gate');
if (llms.includes('20+ reviews') || llms.includes('20+ verified reviews')) fail('llms.txt', 'Contains legacy "20+ reviews"');

pass('Merit gate values checked across all files');

// --- 2. Certified tier consistency ---
console.log('\n2. Certified Tier');

// mcp.json
const mcpCert = mcp.certificationTiers?.certified;
if (mcpCert) {
  if (mcpCert.cost !== 'Free') fail('mcp.json', `Certified cost is "${mcpCert.cost}", expected "Free"`);
  if (mcpCert.standardAuditCycle && !mcpCert.standardAuditCycle.toLowerCase().includes('quarterly'))
    fail('mcp.json', `Certified audit cycle is "${mcpCert.standardAuditCycle}", expected "Quarterly"`);
}

// ai-content-index.json
const aciCert = aci.certificationSystem?.tiers?.certified;
if (aciCert) {
  if (aciCert.cost !== 'Free') fail('ai-content-index.json', `Certified cost is "${aciCert.cost}", expected "Free"`);
  if (aciCert.standardAuditCycle && !aciCert.standardAuditCycle.toLowerCase().includes('quarterly'))
    fail('ai-content-index.json', `Certified audit cycle is "${aciCert.standardAuditCycle}", expected "Quarterly"`);
}

// llms.txt
if (llms.match(/certified.*monthly/i) && !llms.match(/certified.*quarterly/i))
  fail('llms.txt', 'Certified described as monthly instead of quarterly');

pass('Certified tier checked across all files');

// --- 3. Pricing consistency ---
console.log('\n3. Pricing');

const bizPricing = biz.pricing;
if (bizPricing.audited !== 300) fail('businessConfig', `Audited price is ${bizPricing.audited}, expected 300`);
if (bizPricing.underwritten !== 500) fail('businessConfig', `Underwritten price is ${bizPricing.underwritten}, expected 500`);

const mcpAudited = mcp.certificationTiers?.audited;
if (mcpAudited && mcpAudited.cost !== '$300/month') fail('mcp.json', `Audited cost is "${mcpAudited.cost}", expected "$300/month"`);
const mcpUw = mcp.certificationTiers?.underwritten;
if (mcpUw && mcpUw.cost !== '$500/month') fail('mcp.json', `Underwritten cost is "${mcpUw.cost}", expected "$500/month"`);

pass('Pricing checked across all files');

// --- 4. Agent count cross-check (mcp vs aci) ---
console.log('\n4. Agent Counts');

const mcpTotal = mcp.coverage?.summary?.totalAgentsQualified;
const aciTotal = aci.geographicCoverage?.summary?.totalAgentsQualified;
if (mcpTotal && aciTotal && mcpTotal !== aciTotal)
  fail('counts', `mcp.json total (${mcpTotal}) != ai-content-index.json total (${aciTotal})`);
else if (mcpTotal && aciTotal)
  pass(`Agent counts match: ${mcpTotal} in both files`);

// --- 5. Coverage language ---
console.log('\n5. Coverage Language');

const badCoverage = ['top 0.2%', 'top 0.5%', 'top 1%', 'ranks the top'];
for (const phrase of badCoverage) {
  if (mcpDesc.toLowerCase().includes(phrase)) fail('mcp.json', `Contains deprecated "${phrase}"`);
  if (aciStr.toLowerCase().includes(phrase)) fail('ai-content-index.json', `Contains deprecated "${phrase}"`);
  if (llms.toLowerCase().includes(phrase)) fail('llms.txt', `Contains deprecated "${phrase}"`);
}
pass('Coverage language checked');

// --- 6. Evidence sources ---
console.log('\n6. Evidence Sources');

if (aciStr.includes('"14+"') || aciStr.includes('"14+ sources"'))
  fail('ai-content-index.json', 'Contains legacy "14+" evidence count (should be "up to 20")');
if (mcpDesc.includes('"14+"') || mcpDesc.includes('"14+ sources"'))
  fail('mcp.json', 'Contains legacy "14+" evidence count');

pass('Evidence source counts checked');

// --- 7. Em dashes ---
console.log('\n7. Em Dashes');

if (llms.includes('\u2014')) warn('llms.txt', 'Contains em dash character');
if (llmsFull.includes('\u2014')) warn('llms-full.txt', 'Contains em dash character');

pass('Em dash check complete');

// --- Summary ---
console.log('\n' + '='.repeat(40));
if (errors === 0 && warnings === 0) {
  console.log('ALL CHECKS PASSED\n');
  process.exit(0);
} else {
  console.log(`${errors} error(s), ${warnings} warning(s)\n`);
  process.exit(errors > 0 ? 1 : 0);
}
