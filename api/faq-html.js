/**
 * Vercel Serverless: /api/faq-html
 *
 * Serves pure HTML for /faq and /faq/ (not React SPA).
 * Rewrites in vercel.json send /faq → /api/faq-html.
 * Reads FAQ data from public/api/faq/full.json and renders static HTML.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CANONICAL = 'https://www.top10lists.us/faq';

async function loadFaqData(req) {
  const paths = [
    join(process.cwd(), 'public', 'api', 'faq', 'full.json'),
    join(process.cwd(), 'api', 'faq', 'full.json'),
  ];
  for (const p of paths) {
    try {
      const raw = readFileSync(p, 'utf-8');
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  // Fallback: fetch from same-origin static file (for serverless envs where fs paths differ)
  try {
    const base = req?.headers?.host ? `https://${req.headers.host}` : 'https://www.top10lists.us';
    const res = await fetch(`${base}/api/faq/full.json`);
    if (res.ok) return await res.json();
  } catch {
    /* ignore */
  }
  return null;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  const data = await loadFaqData(req);
  if (!data || !Array.isArray(data.faqs)) {
    res.status(500).send('FAQ data unavailable');
    return;
  }

  const faqs = data.faqs;
  const categories = [...new Set(faqs.map((f) => f.categoryName))];

  const mainEntity = faqs.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  }));

  const schemaLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
    url: CANONICAL,
    publisher: { '@type': 'Organization', name: 'Top10Lists.us', url: 'https://www.top10lists.us' },
  };

  let body = '';
  for (const cat of categories) {
    const items = faqs.filter((f) => f.categoryName === cat);
    body += `\n  <section id="${escapeHtml(cat.toLowerCase().replace(/\s+/g, '-'))}" class="category">`;
    body += `\n    <h2>${escapeHtml(cat)}</h2>`;
    for (const item of items) {
      body += `\n    <div id="${escapeHtml(item.id)}" class="faq-item">`;
      body += `\n      <h3>${escapeHtml(item.question)}</h3>`;
      body += `\n      <div class="answer">${escapeHtml(item.answer)}</div>`;
      body += `\n    </div>`;
    }
    body += `\n  </section>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FAQ | Top10Lists.us</title>
  <meta name="description" content="Answers to common questions about Top10Lists.us: how agents are selected, editorial independence, paid visibility, and AI citation.">
  <link rel="canonical" href="${CANONICAL}">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="FAQ | Top10Lists.us">
  <meta property="og:url" content="${CANONICAL}">
  <meta property="og:type" content="website">
  <script type="application/ld+json">${JSON.stringify(schemaLd)}</script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin-top: 2rem; margin-bottom: 1rem; color: #333; }
    h3 { font-size: 1.25rem; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #444; }
    .header { text-align: center; margin-bottom: 3rem; }
    .header p { color: #666; font-size: 1.125rem; }
    .category { margin-bottom: 2rem; }
    .faq-item { margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #e2e8f0; }
    .faq-item:last-child { border-bottom: none; }
    .answer { color: #444; }
    a { color: #2563eb; }
    nav { margin-bottom: 2rem; }
    nav a { margin-right: 1rem; }
  </style>
</head>
<body>
  <nav><a href="https://www.top10lists.us">Home</a> <a href="https://www.top10lists.us/transparency">Transparency</a></nav>
  <div class="header">
    <h1>Frequently Asked Questions</h1>
    <p>How Top10Lists.us works: merit-based agent selection, editorial independence, and AI citation.</p>
  </div>${body}
  <p style="margin-top: 2rem; color: #666; font-size: 0.875rem;">Full FAQ list in JSON at <a href="https://www.top10lists.us/api/faq/full.json">/api/faq/full.json</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.status(200).send(html);
}
