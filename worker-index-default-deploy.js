/**
 * CLOUDFLARE WORKER - index_default block (markdown-only, no Puppeteer)
 * Bot traffic: fetch markdown from Edge Functions, cache, return.
 * Replace the index_default block in cloudflareworker.js.
 * Deploy: .\scripts\deploy-worker.ps1
 */
const SUPABASE_FUNCTIONS = "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1";

const index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";

    // 1. Warm & Purge Endpoints
    if (url.pathname === "/__warm" && request.method === "POST") {
      const secret = request.headers.get("X-Warm-Secret");
      if (secret && env.WARM_SECRET && secret === env.WARM_SECRET) {
        try {
          const body = await request.json();
          const targetUrl = body.url;
          const content = body.html || body.content;
          const isMarkdown = body.format === "markdown" || (typeof content === "string" && content.includes("# "));
          if (targetUrl && typeof content === "string") {
            const cacheUrl = new URL(targetUrl);
            cacheUrl.search = "";
            const cacheKey = new Request(cacheUrl.toString(), { method: "GET", headers: { "User-Agent": "bot-cache-normalized" } });
            const contentType = isMarkdown ? "text/markdown; charset=utf-8" : "text/html;charset=UTF-8";
            await caches.default.put(cacheKey, new Response(content, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=604800" } }));
            return new Response(JSON.stringify({ ok: true, url: targetUrl }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
        } catch (e) {}
      }
      return new Response(JSON.stringify({ error: "Unauthorized or invalid" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/__purge" && request.method === "POST") {
      const secret = request.headers.get("X-Warm-Secret");
      if (secret && env.WARM_SECRET && secret === env.WARM_SECRET) {
        try {
          const body = await request.json();
          const urls = body.urls;
          if (!Array.isArray(urls) || urls.length === 0) {
            return new Response(JSON.stringify({ purged: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          const cache = caches.default;
          let purged = 0;
          for (let i = 0; i < urls.length; i++) {
            const u = urls[i];
            const purgeUrl = new URL(u);
            purgeUrl.search = "";
            const key = new Request(purgeUrl.toString(), { method: "GET", headers: { "User-Agent": "bot-cache-normalized" } });
            const deleted = await cache.delete(key);
            if (deleted) purged++;
          }
          return new Response(JSON.stringify({ purged }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: String(e && e.message) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      }
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    // 2. Bot Identification
    const botPatterns = {
      googlebot: /googlebot|google-inspectiontool|googleother|adsbot-google/i,
      claudebot: /claudebot|claude-web|anthropic-ai/i,
      gptbot: /gptbot|chatgpt-user|oai-searchbot/i,
      bingbot: /bingbot|msnbot/i,
      perplexitybot: /perplexitybot/i,
      metabot: /meta-externalagent|facebookexternalhit|facebookbot/i,
      bytespider: /bytespider/i,
      ahrefsbot: /ahrefsbot/i,
    };
    let botType = null;
    for (const [name, pattern] of Object.entries(botPatterns)) {
      if (pattern.test(ua)) { botType = name; break; }
    }
    if (!botType && (ua.includes("bot") || ua.includes("crawler"))) botType = "unknown_bot";
    const isBot = botType !== null;
    const forceRefresh = request.headers.get("X-Force-Refresh") === "true";

    const cache = caches.default;
    const cacheUrl = new URL(url);
    cacheUrl.search = "";
    const cacheKey = new Request(cacheUrl.toString(), { method: "GET", headers: { "User-Agent": "bot-cache-normalized" } });

    const originUrl = new URL(request.url);
    originUrl.hostname = "list-wise-boost.vercel.app";
    originUrl.protocol = "https:";

    // 3. Non-bots: pass through to origin
    if (!isBot) {
      const originHeaders = new Headers(request.headers);
      if (env.VERCEL_PROTECTION_BYPASS) originHeaders.set("x-vercel-protection-bypass", env.VERCEL_PROTECTION_BYPASS);
      return fetch(new Request(originUrl.toString(), { method: request.method, headers: originHeaders }));
    }

    // 4. Bot: check cache first
    if (!forceRefresh) {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        if (env.NOTIFICATION_QUEUE) {
          const path = url.pathname;
          let agentId = null, agentSlug = null;
          const artifactMatch = path.match(/^\/artifact\/([^/]+)/);
          if (artifactMatch) agentId = artifactMatch[1];
          else {
            const agentsMatch = path.match(/\/([^/]+)\/agents\/([^/]+)/);
            if (agentsMatch) agentSlug = agentsMatch[2];
          }
          ctx.waitUntil(env.NOTIFICATION_QUEUE.send({
            agent_id: agentId,
            agent_slug: agentSlug,
            bot_name: botType,
            timestamp: new Date().toISOString(),
            request_url: request.url,
            user_agent: request.headers.get("user-agent") || null,
            cache_status: "HIT",
            ray_id: request.headers.get("cf-ray") || null,
            host: url.hostname || null,
          }));
        }
        const hitHdrs = new Headers(cachedResponse.headers);
        hitHdrs.set("X-Cache", "HIT");
        return new Response(cachedResponse.body, { status: cachedResponse.status, headers: hitHdrs });
      }
    }

    // 5. Bot cache MISS: enqueue analytics
    if (env.NOTIFICATION_QUEUE) {
      const path = url.pathname;
      let agentId = null, agentSlug = null;
      const artifactMatch = path.match(/^\/artifact\/([^/]+)/);
      if (artifactMatch) agentId = artifactMatch[1];
      else {
        const agentsMatch = path.match(/\/([^/]+)\/agents\/([^/]+)/);
        if (agentsMatch) agentSlug = agentsMatch[2];
      }
      ctx.waitUntil(env.NOTIFICATION_QUEUE.send({
        agent_id: agentId,
        agent_slug: agentSlug,
        bot_name: botType,
        timestamp: new Date().toISOString(),
        request_url: request.url,
        user_agent: request.headers.get("user-agent") || null,
        cache_status: "MISS",
        ray_id: request.headers.get("cf-ray") || null,
        host: url.hostname || null,
      }));
    }

    // 6. Fetch full HTML/markdown from appropriate source
    const staticPaths = new Set([
      "/", "/arizona", "/california", "/texas", "/florida", "/new-york", "/colorado",
      "/about", "/about/founder", "/about/ranking-methodology",
      "/for-ai", "/for-ai-systems", "/transparency", "/ai-liability", "/ai-citation-whitepaper", "/protocol-services",
      "/press", "/editorial-updates", "/compare", "/zillow-explained", "/faq",
      "/privacy", "/terms", "/sms-terms", "/opt-in",
      "/test", "/are-you-an-agent", "/agent-onboarding",
    ]);
    const isStaticPath = (path) => staticPaths.has((path.replace(/\/+$/, "") || "/"));

    let markdownUrl = null;
    if (url.pathname.match(/^\/artifact\/[^/]+$/)) {
      markdownUrl = originUrl.toString();
    } else if (url.pathname.match(/\/[^/]+\/agents\/[^/]+$/)) {
      const m = url.pathname.match(/\/([^/]+)\/agents\/([^/]+)/);
      if (m) markdownUrl = `${SUPABASE_FUNCTIONS}/serve-agent-profile-markdown?state=${encodeURIComponent(m[1])}&slug=${encodeURIComponent(m[2])}`;
    } else if (url.pathname.includes("top10realestateagents")) {
      markdownUrl = `${SUPABASE_FUNCTIONS}/serve-bot-list-html?path=${encodeURIComponent(url.pathname)}`;
    } else if (isStaticPath(url.pathname)) {
      markdownUrl = `${SUPABASE_FUNCTIONS}/serve-bot-static-html?path=${encodeURIComponent(url.pathname)}`;
    }

    if (markdownUrl) {
      try {
        const headers = new Headers();
        if (url.hostname === "list-wise-boost.vercel.app" && env.VERCEL_PROTECTION_BYPASS) {
          headers.set("x-vercel-protection-bypass", env.VERCEL_PROTECTION_BYPASS);
        }
        const res = await fetch(markdownUrl, { headers });
        const contentType = res.headers.get("Content-Type") || "";
        const isAcceptable = res.ok && (contentType.includes("text/html") || contentType.includes("text/markdown"));
        if (isAcceptable) {
          const body = await res.text();
          const response = new Response(body, {
            status: 200,
            headers: {
              "Content-Type": contentType.includes("text/html") ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8",
              "X-Cache": "MISS",
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
            },
          });
          await cache.put(cacheKey, response.clone());
          return response;
        }
        if (res.ok) return res;
      } catch (err) {
        console.error("Markdown fetch failed:", err.message);
      }
    }

    // 7. Fallback: pass through to origin (e.g. static pages, non-list routes)
    const originHeaders = new Headers(request.headers);
    if (env.VERCEL_PROTECTION_BYPASS) originHeaders.set("x-vercel-protection-bypass", env.VERCEL_PROTECTION_BYPASS);
    return fetch(new Request(originUrl.toString(), { method: "GET", headers: originHeaders }));
  },
};
