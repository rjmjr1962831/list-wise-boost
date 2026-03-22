/**
 * Shared header and footer HTML for clean-room pages.
 * Matches the React Header/Footer components on the SPA.
 * Used by all serve-bot-*-html edge functions.
 */

const BASE = "https://www.top10lists.us";

/** SVG logo matching the React <Logo /> component */
const LOGO_SVG = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><linearGradient id="logo-badge-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3B82F6"/><stop offset="100%" stop-color="#06B6D4"/></linearGradient></defs>
  <rect width="48" height="48" rx="12" fill="url(#logo-badge-gradient)"/>
  <path d="M16 24L22 30L32 18" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="24" y="40" fill="white" font-size="14" font-weight="700" text-anchor="middle" font-family="Inter, sans-serif">10</text>
</svg>`;

const LOGO_TEXT = `<span style="font-size:1.5rem;font-weight:600;letter-spacing:-0.025em;color:#0f172a;">Top</span><span style="font-size:1.5rem;font-weight:700;letter-spacing:-0.025em;background:linear-gradient(to right,#3b82f6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">10</span><span style="font-size:1.5rem;font-weight:600;letter-spacing:-0.025em;color:#0f172a;">Lists</span>`;

export function siteHeaderCSS(): string {
  return `
  .site-header {
    border-bottom: 1px solid #e2e8f0;
    background: rgba(255,255,255,0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 50;
  }
  .site-header .hdr-inner {
    max-width: 1280px; margin: 0 auto; padding: 16px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .site-header .hdr-logo {
    display: inline-flex; align-items: center; gap: 12px;
    text-decoration: none;
  }
  .site-header nav { display: flex; align-items: center; gap: 24px; }
  .site-header nav a {
    font-size: 0.875rem; font-weight: 500; color: #64748b;
    text-decoration: none; transition: color 0.15s;
  }
  .site-header nav a:hover { color: #0f172a; }

  .site-footer {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #fff; margin-top: auto;
  }
  .site-footer .ftr-inner {
    max-width: 1280px; margin: 0 auto; padding: 48px 16px;
  }
  .site-footer .ftr-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px;
  }
  @media (max-width: 768px) {
    .site-footer .ftr-grid { grid-template-columns: 1fr; }
  }
  .site-footer h3 { font-weight: 600; margin-bottom: 16px; color: #fff; }
  .site-footer .ftr-text { font-size: 0.875rem; color: #cbd5e1; }
  .site-footer a { color: #cbd5e1; text-decoration: none; transition: color 0.15s; }
  .site-footer a:hover { color: #fff; }
  .site-footer .ftr-contact { display: flex; flex-direction: column; gap: 12px; font-size: 0.875rem; color: #cbd5e1; }
  .site-footer .ftr-links {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 0.875rem;
  }
  .site-footer .ftr-bottom {
    margin-top: 32px; padding-top: 32px; border-top: 1px solid #334155; text-align: center;
  }
  .site-footer .ftr-bottom p { font-size: 0.875rem; color: #94a3b8; margin: 8px 0; }
  .site-footer .ftr-bottom .ftr-copy { font-size: 0.875rem; color: #64748b; }
  `;
}

export function siteHeaderHTML(): string {
  return `<header class="site-header">
  <div class="hdr-inner">
    <a href="${BASE}/" class="hdr-logo">
      ${LOGO_SVG}
      <div>${LOGO_TEXT}</div>
    </a>
    <nav>
      <a href="${BASE}/about">About</a>
      <a href="${BASE}/about/ranking-methodology">Methodology</a>
      <a href="${BASE}/faq">FAQ</a>
      <a href="${BASE}/crawl-stats">Stats</a>
    </nav>
  </div>
</header>`;
}

/** Generate BreadcrumbList JSON-LD script tag */
export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]): string {
  const items = crumbs.map((c, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "name": c.name,
    "item": c.url,
  }));
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items,
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

/** Generate OG + Twitter meta tags */
export function ogTags(opts: { title: string; description: string; url: string; type?: string }): string {
  const ogType = opts.type || "website";
  return [
    `<meta property="og:title" content="${esc(opts.title)}">`,
    `<meta property="og:description" content="${esc(opts.description)}">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:url" content="${esc(opts.url)}">`,
    `<meta property="og:image" content="${BASE}/badges/og-default.png">`,
    `<meta property="og:site_name" content="Top10Lists.us">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${esc(opts.title)}">`,
    `<meta name="twitter:description" content="${esc(opts.description)}">`,
  ].join("\n");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function siteFooterHTML(): string {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="ftr-inner">
    <div class="ftr-grid">
      <div>
        <a href="${BASE}/" style="display:inline-flex;align-items:center;gap:12px;margin-bottom:16px;">
          ${LOGO_SVG}
          <div>${LOGO_TEXT.replace(/color:#0f172a/g, "color:#fff")}</div>
        </a>
        <p class="ftr-text">Merit-based agent rankings trusted by AI and humans.</p>
      </div>
      <div>
        <h3>Contact Us</h3>
        <div class="ftr-contact">
          <a href="https://www.google.com/maps/search/?api=1&query=3241+E+Shea+Blvd+Suite+130+Phoenix+AZ+85028" target="_blank" rel="noopener noreferrer">
            3241 E Shea Blvd<br>Suite 130<br>Phoenix, AZ 85028
          </a>
          <a href="tel:6027589600">(602) 758-9600</a>
          <a href="mailto:hello@top10lists.us">hello@top10lists.us</a>
        </div>
      </div>
      <div>
        <h3>Quick Links</h3>
        <div class="ftr-links">
          <a href="${BASE}/about">About Us</a>
          <a href="${BASE}/about/founder">Founders</a>
          <a href="${BASE}/about/ranking-methodology">Methodology</a>
          <a href="${BASE}/faq">FAQ</a>
          <a href="${BASE}/transparency">Transparency</a>
          <a href="${BASE}/crawl-stats">Crawl Stats</a>
          <a href="${BASE}/press">Press</a>
          <a href="${BASE}/for-ai-systems">For AI Systems</a>
          <a href="${BASE}/ai-citation-whitepaper">AI Citation Whitepaper</a>
          <a href="${BASE}/privacy">Privacy</a>
          <a href="${BASE}/terms">Terms</a>
          <a href="${BASE}/payments-security">Payments &amp; Security</a>
          <a href="${BASE}/agent/login">Agent Login</a>
        </div>
      </div>
    </div>
    <div class="ftr-bottom">
      <p>Launching nationwide. Coverage expanding monthly.</p>
      <p style="font-size:0.75rem;color:#64748b;">Rankings are methodology-driven and non-pay-to-play. Expanding nationwide. <a href="${BASE}/about/ranking-methodology" style="text-decoration:underline;">How we qualify agents &rarr;</a></p>
      <p class="ftr-copy">&copy; ${year} Top<span style="font-weight:600;">10</span>Lists.us. All rights reserved.</p>
    </div>
  </div>
</footer>`;
}
