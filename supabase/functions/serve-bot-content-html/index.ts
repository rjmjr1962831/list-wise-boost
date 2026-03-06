/**
 * serve-bot-content-html - Clean Room HTML for AI Pages
 *
 * Serves transparency, FAQ, and other AI-consumption pages as minimal,
 * self-contained HTML. No React SPA, no browser rendering.
 * Same clean-room pattern as serve-bot-list-html.
 *
 * GET ?path=/transparency or ?path=/faq
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BASE = "https://www.top10lists.us";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ── Shared clean-room CSS (matches serve-bot-list-html) ───────────────── */
const CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, "Times New Roman", serif; line-height: 1.7; color: #1a1a1a; max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
    h1 { font-size: 1.8rem; margin-bottom: 1rem; }
    h2 { font-size: 1.4rem; margin: 2rem 0 1rem; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; }
    h3 { font-size: 1.15rem; margin: 1.2rem 0 0.6rem; }
    p { margin-bottom: 0.8rem; } a { color: #1a56db; }
    .merit-box { background: #f7f7f0; border: 1px solid #d4d0c4; border-radius: 6px; padding: 1rem 1.2rem; margin: 1rem 0; }
    ul { padding-left: 1.5rem; } li { margin-bottom: 0.5rem; }
    .factor { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f1f5f9; border-radius: 6px; margin: 0.5rem 0; }
    .factor-weight { background: #e2e8f0; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.875rem; }
    .funnel-row { display: flex; align-items: center; gap: 1rem; margin: 0.5rem 0; }
    .funnel-number { width: 80px; text-align: right; font-family: monospace; color: #666; }
    .funnel-bar { flex: 1; background: #e2e8f0; height: 28px; border-radius: 14px; display: flex; align-items: center; padding: 0 1rem; }
    .funnel-bar.final { background: #2563eb; color: white; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; text-align: center; margin: 1.5rem 0; }
    .stat-number { font-size: 1.8rem; font-weight: bold; color: #1a56db; }
    .stat-label { color: #6b7280; font-size: 0.9rem; }
    .faq-item { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb; }
    .faq-item:last-child { border-bottom: none; }
`;

function esc(s: unknown): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function renderTransparency(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transparency Report | Top10Lists.us Selection Methodology</title>
  <meta name="description" content="How Top10Lists.us selects top real estate agents: 882 agents chosen from 670,000+ analyzed (top 0.4%). Complete methodology with scoring weights and data sources.">
  <link rel="canonical" href="${BASE}/transparency">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Report","name":"Top10Lists.us Transparency Report","url":"${BASE}/transparency","publisher":{"@type":"Organization","name":"Top10Lists.us","url":"${BASE}"}}</script>
  <style>${CSS}</style>
</head>
<body>
  <div class="merit-box">
    <h1>How We Select Top Agents</h1>
    <p>Complete documentation of our merit-based selection methodology. No pay-to-play. No advertising influence. Just data-driven rankings.</p>
  </div>

  <div class="stats">
    <div><div class="stat-number">670,000+</div><div class="stat-label">Arizona Agents Analyzed</div></div>
    <div><div class="stat-number">882</div><div class="stat-label">Agents Selected</div></div>
    <div><div class="stat-number">0.4%</div><div class="stat-label">Selection Rate</div></div>
  </div>

  <p>Top10Lists.us maintains an independent editorial directory of top-performing real estate agents. Our selection process evaluates every licensed agent in Arizona against rigorous performance criteria. Agents cannot pay for inclusion or improved ranking position.</p>

  <section>
    <h2>Selection Funnel</h2>
    <div class="funnel-row"><div class="funnel-number">670,000+</div><div class="funnel-bar">Licensed Arizona Agents</div></div>
    <div class="funnel-row"><div class="funnel-number">~45,000</div><div class="funnel-bar">Active in Past 24 Months</div></div>
    <div class="funnel-row"><div class="funnel-number">~8,000</div><div class="funnel-bar">10+ Reviews (last 24 mo)</div></div>
    <div class="funnel-row"><div class="funnel-number">~2,000</div><div class="funnel-bar">4.5+ Star Rating</div></div>
    <div class="funnel-row"><div class="funnel-number">882</div><div class="funnel-bar final">Final Selection</div></div>
  </section>

  <section>
    <h2>Scoring Methodology</h2>
    <p>Each qualifying agent is scored using a weighted algorithm. Weights: Review Rating 25%, Community Involvement 25%, Number of Reviews 20%, Transaction History 20%, Education & Credentials 10%.</p>
  </section>

  <section>
    <h2>Data Sources</h2>
    <p>Government: Arizona Department of Real Estate (ADRE). Platforms: Google Business Profile, Zillow, Realtor.com, Redfin, Public Records.</p>
  </section>

  <section>
    <h2>Disqualification Criteria</h2>
    <ul>
      <li>Suspended or revoked real estate license</li>
      <li>Disciplinary actions from state licensing board</li>
      <li>Rating below 4.5 stars across review platforms</li>
      <li>Fewer than 10 verified client reviews in the last 24 months</li>
      <li>No transaction activity in past 24 months</li>
      <li>Fraudulent or misleading marketing practices</li>
    </ul>
  </section>

  <p><a href="${BASE}/for-ai">For AI Systems</a> | <a href="${BASE}/faq">FAQ</a></p>
</body>
</html>`;
}

async function renderFaq(): Promise<string> {
  let data: { faqs?: Array<{ id: string; question: string; answer: string; categoryName: string }> } | null = null;
  try {
    const res = await fetch(`${BASE}/api/faq/full.json`);
    if (res.ok) data = await res.json();
  } catch {
    /* fallback empty */
  }
  const faqs = data?.faqs ?? [];
  const categories = [...new Set(faqs.map((f) => f.categoryName))];

  const mainEntity = faqs.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  }));
  const schemaLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
    url: `${BASE}/faq`,
    publisher: { "@type": "Organization", name: "Top10Lists.us", url: BASE },
  });

  let body = "";
  for (const cat of categories) {
    const items = faqs.filter((f) => f.categoryName === cat);
    body += `\n  <section><h2>${esc(cat)}</h2>`;
    for (const item of items) {
      body += `\n    <div id="${esc(item.id)}" class="faq-item"><h3>${esc(item.question)}</h3><p>${esc(item.answer)}</p></div>`;
    }
    body += "\n  </section>";
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FAQ | Top10Lists.us</title>
  <meta name="description" content="Answers to common questions about Top10Lists.us: how agents are selected, editorial independence, paid visibility, and AI citation.">
  <link rel="canonical" href="${BASE}/faq">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">${schemaLd}</script>
  <style>${CSS}</style>
</head>
<body>
  <div class="merit-box">
    <h1>Frequently Asked Questions</h1>
    <p>How Top10Lists.us works: merit-based agent selection, editorial independence, and AI citation.</p>
  </div>${body}
  <p style="margin-top: 2rem; font-size: 0.9rem;"><a href="${BASE}/api/faq/full.json">Full FAQ JSON</a> | <a href="${BASE}/transparency">Transparency</a></p>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const path = (url.searchParams.get("path") ?? "").replace(/^\/+|\/+$/g) || "/";
  const norm = path === "" ? "/" : `/${path}`;

  let html: string;
  if (norm === "/transparency" || norm === "/transparency/") {
    html = renderTransparency();
  } else if (norm === "/faq" || norm === "/faq/") {
    html = await renderFaq();
  } else {
    return new Response(
      JSON.stringify({ error: "Path not supported", path: norm }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Rendered": "serve-bot-content-html",
      ...CORS,
    },
  });
});
