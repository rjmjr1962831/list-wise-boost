#!/usr/bin/env node
/**
 * Deep Serper search on George Laughton — 10 different search angles,
 * compile full report, email via gmail-send.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim();
}

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERPER_KEY = process.env.SERPER_API_KEY;

function httpPost(hostname, reqPath, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname, path: reqPath, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse: ${data.slice(0, 500)}`)); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function serper(query, type = 'search', extra = {}) {
  return httpPost('google.serper.dev', `/${type}`, {
    'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json'
  }, { q: query, num: 10, ...extra });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Format a single organic result as report text
function fmtResult(r, idx) {
  let out = `${idx}. ${r.title || 'Untitled'}\n`;
  out += `   Link: ${r.link}\n`;
  if (r.snippet) out += `   ${r.snippet}\n`;
  if (r.date) out += `   Date: ${r.date}\n`;
  if (r.rating) out += `   Rating: ${r.rating} (${r.ratingCount || '?'} reviews)\n`;
  if (r.price) out += `   Price: ${r.price}\n`;
  if (r.sitelinks) {
    for (const sl of r.sitelinks.slice(0, 3)) {
      out += `   → ${sl.title}: ${sl.link}\n`;
    }
  }
  return out;
}

function fmtSection(title, data) {
  let out = `\n${'━'.repeat(60)}\n${title}\n${'━'.repeat(60)}\n\n`;

  if (data.knowledgeGraph) {
    const kg = data.knowledgeGraph;
    out += `KNOWLEDGE GRAPH:\n`;
    out += `  Title: ${kg.title || 'N/A'}\n`;
    if (kg.type) out += `  Type: ${kg.type}\n`;
    if (kg.description) out += `  Description: ${kg.description}\n`;
    if (kg.website) out += `  Website: ${kg.website}\n`;
    if (kg.phone) out += `  Phone: ${kg.phone}\n`;
    if (kg.rating) out += `  Rating: ${kg.rating} (${kg.ratingCount || '?'} reviews)\n`;
    if (kg.address) out += `  Address: ${kg.address}\n`;
    if (kg.imageUrl) out += `  Image: ${kg.imageUrl}\n`;
    if (kg.attributes) {
      for (const [k, v] of Object.entries(kg.attributes)) {
        out += `  ${k}: ${v}\n`;
      }
    }
    out += '\n';
  }

  if (data.answerBox) {
    const ab = data.answerBox;
    out += `ANSWER BOX:\n`;
    if (ab.title) out += `  Title: ${ab.title}\n`;
    if (ab.answer) out += `  Answer: ${ab.answer}\n`;
    if (ab.snippet) out += `  Snippet: ${ab.snippet}\n`;
    if (ab.link) out += `  Link: ${ab.link}\n`;
    out += '\n';
  }

  if (data.organic?.length) {
    out += `RESULTS (${data.organic.length}):\n\n`;
    data.organic.forEach((r, i) => { out += fmtResult(r, i + 1) + '\n'; });
  }

  if (data.peopleAlsoAsk?.length) {
    out += `PEOPLE ALSO ASK:\n`;
    for (const q of data.peopleAlsoAsk) {
      out += `  Q: ${q.question}\n`;
      if (q.snippet) out += `     ${q.snippet.slice(0, 200)}\n`;
      if (q.link) out += `     Source: ${q.link}\n`;
    }
    out += '\n';
  }

  if (data.relatedSearches?.length) {
    out += `RELATED SEARCHES:\n`;
    for (const rs of data.relatedSearches) {
      out += `  • ${rs.query}\n`;
    }
    out += '\n';
  }

  // For news
  if (data.news?.length) {
    out += `NEWS RESULTS (${data.news.length}):\n\n`;
    data.news.forEach((r, i) => {
      out += `${i + 1}. ${r.title}\n`;
      out += `   Link: ${r.link}\n`;
      if (r.snippet) out += `   ${r.snippet}\n`;
      if (r.date) out += `   Date: ${r.date}\n`;
      if (r.source) out += `   Source: ${r.source}\n`;
      out += '\n';
    });
  }

  // For images
  if (data.images?.length) {
    out += `IMAGE RESULTS (${data.images.length}):\n\n`;
    data.images.forEach((r, i) => {
      out += `${i + 1}. ${r.title || 'Image'}\n`;
      out += `   Source: ${r.link}\n`;
      if (r.imageUrl) out += `   Image URL: ${r.imageUrl}\n`;
      out += '\n';
    });
  }

  // For places
  if (data.places?.length) {
    out += `PLACES RESULTS (${data.places.length}):\n\n`;
    data.places.forEach((r, i) => {
      out += `${i + 1}. ${r.title}\n`;
      if (r.address) out += `   Address: ${r.address}\n`;
      if (r.rating) out += `   Rating: ${r.rating} (${r.ratingCount || '?'} reviews)\n`;
      if (r.phone) out += `   Phone: ${r.phone}\n`;
      if (r.website) out += `   Website: ${r.website}\n`;
      if (r.cid) out += `   Google CID: ${r.cid}\n`;
      out += '\n';
    });
  }

  if (!data.organic?.length && !data.news?.length && !data.images?.length && !data.places?.length && !data.knowledgeGraph) {
    out += '(No results found)\n';
  }

  return out;
}

async function main() {
  console.log('Running 10 Serper searches for George Laughton...');

  const searches = [
    { label: '1. GENERAL REPUTATION', query: 'George Laughton real estate agent Avondale Arizona', type: 'search' },
    { label: '2. REVIEWS & RATINGS', query: '"George Laughton" OR "Laughton Team" real estate reviews ratings Arizona', type: 'search' },
    { label: '3. PRESS & MEDIA COVERAGE', query: '"George Laughton" OR "Laughton Team" real estate Arizona press award featured', type: 'search' },
    { label: '4. NEWS', query: 'George Laughton Laughton Team real estate Arizona', type: 'news' },
    { label: '5. TRANSACTIONS & SALES HISTORY', query: '"George Laughton" OR "Laughton Team" real estate sold transactions volume Arizona', type: 'search' },
    { label: '6. COMMUNITY INVOLVEMENT & CHARITY', query: '"George Laughton" OR "Laughton Team" Arizona community charity volunteer board nonprofit', type: 'search' },
    { label: '7. LINKEDIN & PROFESSIONAL PROFILES', query: 'George Laughton Laughton Team My Home Group LinkedIn site:linkedin.com', type: 'search' },
    { label: '8. ZILLOW & REAL ESTATE PLATFORMS', query: 'George Laughton site:zillow.com OR site:realtor.com OR site:homes.com OR site:redfin.com', type: 'search' },
    { label: '9. GOOGLE BUSINESS & LOCAL', query: 'Laughton Team real estate Peoria Arizona', type: 'places' },
    { label: '10. IMAGES', query: 'George Laughton Laughton Team real estate Arizona', type: 'images' },
  ];

  let report = `SERPER DEEP SEARCH REPORT: GEORGE LAUGHTON — AVONDALE, ARIZONA
Generated: ${new Date().toISOString().split('T')[0]}
Searches: ${searches.length} queries across web, news, places, and images
Source: Google via Serper API

`;

  // Collect all unique links for a master list
  const allLinks = new Map(); // url -> title

  for (const s of searches) {
    console.log(`  Searching: ${s.label}...`);
    try {
      const data = await serper(s.query, s.type);
      report += fmtSection(s.label, data);

      // Collect links
      for (const r of (data.organic || [])) {
        if (r.link && !allLinks.has(r.link)) allLinks.set(r.link, r.title);
        if (r.sitelinks) {
          for (const sl of r.sitelinks) {
            if (sl.link && !allLinks.has(sl.link)) allLinks.set(sl.link, sl.title || sl.link);
          }
        }
      }
      for (const r of (data.news || [])) {
        if (r.link && !allLinks.has(r.link)) allLinks.set(r.link, r.title);
      }
      for (const r of (data.places || [])) {
        if (r.website && !allLinks.has(r.website)) allLinks.set(r.website, r.title);
      }
      if (data.knowledgeGraph?.website) {
        allLinks.set(data.knowledgeGraph.website, data.knowledgeGraph.title || 'Knowledge Graph');
      }
    } catch (err) {
      report += fmtSection(s.label, {}) + `ERROR: ${err.message}\n`;
    }
    await sleep(500);
  }

  // Master link directory
  report += `\n${'━'.repeat(60)}\nMASTER LINK DIRECTORY (${allLinks.size} unique links)\n${'━'.repeat(60)}\n\n`;
  let linkIdx = 1;
  for (const [url, title] of allLinks) {
    report += `${linkIdx}. [${title}](${url})\n`;
    linkIdx++;
  }

  report += `\n${'━'.repeat(60)}\nEND OF REPORT\nGenerated by Top10Lists.us Intelligence System\n${'━'.repeat(60)}\n`;

  // Save locally
  fs.writeFileSync(path.join(__dirname, 'serper-laughton-report.txt'), report);
  console.log('Report saved locally. Sending email...');

  // Send via gmail-send
  const emailBody = JSON.stringify({
    from_account: 'robert@top10lists.us',
    to: 'robert@aryah.ai',
    subject: 'Serper Deep Search Report: George Laughton — Avondale, AZ (10 searches, all links clickable)',
    message_body: report
  });

  const url = new URL(`${SB_URL}/functions/v1/gmail-send`);
  const res = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: {
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailBody)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(emailBody);
    req.end();
  });

  console.log(`Email sent: ${res.status} — ${res.body}`);
}

main().catch(err => { console.error(`FATAL: ${err.message}`); process.exit(1); });
