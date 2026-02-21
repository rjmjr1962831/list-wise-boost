/**
 * Top10Lists.us Embeddable Badge Widget
 * Usage: <script src="https://www.top10lists.us/widget/badge.js" data-agent-id="canonical-slug" data-style="dark" async></script>
 * Multiple badges: add multiple script tags with different data-agent-id.
 */
(function () {
  const BASE = 'https://www.top10lists.us';
  const API = BASE + '/api/badge';
  const TIMEOUT = 3000;

  function runOne(scriptEl, cfg) {
    if (!cfg.agentId) return;

    const container = document.createElement('div');
    container.className = 't10l-badge-widget';
    container.setAttribute('data-t10l-agent', cfg.agentId);
    scriptEl.parentNode.insertBefore(container, scriptEl);

  function renderFallback(cont) {
    cont.innerHTML = '<a href="' + BASE + '" target="_blank" rel="noopener" class="t10l-badge t10l-badge-fallback"><span class="t10l-badge-text">Verified by Top10Lists.us</span></a>';
    injectStyles();
  }

  function renderRevoked(cont) {
    cont.innerHTML = '<a href="' + BASE + '" target="_blank" rel="noopener" class="t10l-badge t10l-badge-revoked"><span class="t10l-badge-text">Verification Expired</span><span class="t10l-badge-sub">Top10Lists.us</span></a>';
    injectStyles();
  }

  function renderNotFound(cont) {
    cont.innerHTML = '';
    cont.style.display = 'none';
  }

  function injectStyles() {
    if (document.getElementById('t10l-badge-styles')) return;
    const style = document.createElement('style');
    style.id = 't10l-badge-styles';
    style.textContent = '.t10l-badge{display:inline-block;font-family:system-ui,-apple-system,sans-serif;text-decoration:none;border-radius:8px;transition:opacity .2s}.t10l-badge:hover{opacity:.9}.t10l-badge-fallback,.t10l-badge-revoked{padding:10px 14px;font-size:13px}.t10l-badge-fallback{background:#1a1a2e;color:#fff}.t10l-badge-revoked{background:#e5e7eb;color:#6b7280}.t10l-badge-sub{display:block;font-size:11px;margin-top:2px}.t10l-badge-card{max-width:300px;padding:16px;border-radius:8px;box-sizing:border-box}.t10l-badge-dark{background:#1a1a2e;color:#fff}.t10l-badge-light{background:#fff;color:#1a1a2e;border:1px solid #e5e7eb}.t10l-badge-minimal{background:transparent;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px}.t10l-badge-card .t10l-name{font-weight:600;font-size:15px;margin-bottom:4px}.t10l-badge-card .t10l-tier{font-size:11px;text-transform:uppercase;letter-spacing:.05em;opacity:.9;margin-bottom:6px}.t10l-badge-card .t10l-meta{font-size:12px;opacity:.85;margin-bottom:4px}.t10l-badge-card .t10l-stars{font-size:13px;margin:6px 0}.t10l-badge-card .t10l-verified{font-size:11px;opacity:.8;margin-top:8px}.t10l-badge-card img{height:40px;width:auto;margin-bottom:8px}';
    (document.head || document.documentElement).appendChild(style);
  }

  function buildCard(a, style) {
    const tierLabel = { certified: 'Certified', audited: 'Audited', underwritten: 'Underwritten' }[a.tier] || a.tier;
    const styleClass = 't10l-badge-' + (style === 'light' ? 'light' : style === 'minimal' ? 'minimal' : 'dark');
    let stars = '';
    if (a.rating != null) {
      const full = Math.floor(a.rating);
      const half = a.rating % 1 >= 0.5;
      stars = '\u2605'.repeat(full) + (half ? '\u00BD' : '') + ' ' + a.rating.toFixed(1);
      if (a.reviewCount > 0) stars += ' (' + a.reviewCount + ' reviews)';
    }
    const market = [a.city, a.licenseState].filter(Boolean).join(', ');
    const verifiedStr = a.verifiedDate ? 'Verified ' + formatVerified(a.verifiedDate) : 'Verified by Top10Lists.us';

    if (style === 'minimal') {
      return '<a href="' + escapeAttr(a.profileUrl) + '" target="_blank" rel="noopener" class="t10l-badge t10l-badge-card t10l-badge-minimal ' + styleClass + '">' +
        '<img src="' + escapeAttr(a.badgeImageUrl) + '" alt="' + escapeAttr(tierLabel) + '" />' +
        '<span class="t10l-name">' + escapeHtml(a.name) + '</span>' +
        '<span class="t10l-tier">' + escapeHtml(tierLabel) + ' Agent</span>' +
        '</a>';
    }

    return '<a href="' + escapeAttr(a.profileUrl) + '" target="_blank" rel="noopener" class="t10l-badge t10l-badge-card ' + styleClass + '">' +
      '<img src="' + escapeAttr(a.badgeImageUrl) + '" alt="' + escapeAttr(tierLabel) + '" />' +
      '<div class="t10l-name">' + escapeHtml(a.name) + '</div>' +
      '<div class="t10l-tier">' + escapeHtml(tierLabel) + ' Agent</div>' +
      (market ? '<div class="t10l-meta">' + escapeHtml(market) + '</div>' : '') +
      (stars ? '<div class="t10l-stars">' + stars + '</div>' : '') +
      (a.transactionCount > 0 ? '<div class="t10l-meta">' + a.transactionCount + ' verified transactions</div>' : '') +
      '<div class="t10l-verified">' + escapeHtml(verifiedStr) + '</div>' +
      '</a>';
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function formatVerified(iso) {
    try {
      const d = new Date(iso);
      const m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()];
      return m + ' ' + d.getDate() + ', ' + d.getFullYear();
    } catch (e) { return iso; }
  }

  function injectJsonLd(a) {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: a.name,
      jobTitle: 'Real Estate Agent',
      worksFor: a.brokerage ? { '@type': 'RealEstateAgent', name: a.brokerage } : undefined,
      hasCredential: {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'Professional Certification',
        name: 'Top10Lists ' + ({ certified: 'Certified', audited: 'Audited', underwritten: 'Underwritten' }[a.tier] || a.tier) + ' Agent',
        recognizedBy: { '@type': 'Organization', name: 'Top10Lists.us', url: BASE, description: 'Independent merit-based real estate agent directory' },
        validFrom: a.verifiedDate || undefined,
        url: a.profileUrl
      },
      aggregateRating: (a.rating != null && a.reviewCount > 0) ? { '@type': 'AggregateRating', ratingValue: a.rating, reviewCount: a.reviewCount, bestRating: 5 } : undefined
    };
    if (!ld.worksFor) delete ld.worksFor;
    if (!ld.aggregateRating) delete ld.aggregateRating;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(ld);
    (document.head || document.documentElement).appendChild(script);
  }

  function injectNoscript(a, cont) {
    const tierLabel = { certified: 'Certified', audited: 'Audited', underwritten: 'Underwritten' }[a.tier] || a.tier;
    const market = [a.city, a.state].filter(Boolean).join(', ');
    const verifiedStr = a.verifiedDate ? formatVerified(a.verifiedDate) : 'Top10Lists.us';
    let licenseBroker = '';
    if (a.licenseNumber) licenseBroker = 'License: ' + escapeHtml(a.licenseNumber) + (a.licenseState ? ' (' + escapeHtml(a.licenseState) + ')' : '');
    if (a.brokerage) licenseBroker += (licenseBroker ? ' | ' : '') + 'Brokerage: ' + escapeHtml(a.brokerage);
    const html = '<noscript><div class="t10l-badge-fallback"><p><strong>' + escapeHtml(a.name) + '</strong> is a Top10Lists.us <strong>' + escapeHtml(tierLabel) + '</strong> real estate agent in ' + escapeHtml(market) + '.</p>' +
      '<p>Rating: ' + (a.rating != null ? a.rating + '/5' : 'N/A') + ' (' + (a.reviewCount || 0) + ' verified reviews) | ' + (a.transactionCount || 0) + ' verified transactions</p>' +
      (licenseBroker ? '<p>' + licenseBroker + '</p>' : '') +
      '<p>Verified: ' + escapeHtml(verifiedStr) + '</p>' +
      '<p><a href="' + escapeAttr(a.profileUrl) + '">View full verified credential on Top10Lists.us</a></p></div></noscript>';
    cont.insertAdjacentHTML('afterend', html);
  }

    const ctrl = new AbortController();
    const tid = setTimeout(function () { ctrl.abort(); }, TIMEOUT);

    fetch(API + '/' + encodeURIComponent(cfg.agentId), { signal: ctrl.signal })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        clearTimeout(tid);
        if (data.error === 'revoked') {
          renderRevoked(container);
          return;
        }
        if (data.error === 'not_found' || !data.agent) {
          renderNotFound(container);
          return;
        }
        injectStyles();
        container.innerHTML = buildCard(data.agent, cfg.style);
        injectJsonLd(data.agent);
        injectNoscript(data.agent, container);
      })
      .catch(function () {
        clearTimeout(tid);
        renderFallback(container);
      });
  }

  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    if (s.src && s.src.indexOf('/widget/badge.js') !== -1 && !s.getAttribute('data-t10l-processed')) {
      s.setAttribute('data-t10l-processed', '1');
      var agentId = s.getAttribute('data-agent-id') || '';
      var style = (s.getAttribute('data-style') || 'dark').toLowerCase();
      if (agentId) runOne(s, { agentId: agentId, style: style });
    }
  }
})();
