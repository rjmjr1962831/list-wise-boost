/**
 * CLOUDFLARE WORKER - index_default block
 * Replace lines 19936-20270 in cloudflareworker.js with this block.
 *
 * To deploy: Run .\scripts\deploy-worker.ps1 from project root.
 * (Deploy reads cloudflareworker.js and uploads to Cloudflare via Supabase.)
 *
 * NOTE: I didn't receive the txt file you mentioned. If you have additional
 * changes, paste them and I'll merge them into this block.
 */

// src/index.js
const index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";

    // 1. Warm & Purge Endpoints
    // Policy: Cached (bot) pages = text/markdown only. Full HTML is only for human-facing (pass-through to origin).
    if (url.pathname === "/__warm" && request.method === "POST") {
      const secret = request.headers.get("X-Warm-Secret");
      if (secret && env.WARM_SECRET && secret === env.WARM_SECRET) {
        try {
          const body = await request.json();
          const targetUrl = body.url;
          const content = body.html || body.content;
          const isMarkdown = body.format === "markdown" || (typeof content === "string" && content.includes("# ") && (content.includes("## `") || content.includes("REASONING_NUGGET")));
          const looksLikeHtml = typeof content === "string" && (content.trimStart().startsWith("<!") || content.includes("</html>"));
          if (targetUrl && typeof content === "string") {
            if (!isMarkdown || looksLikeHtml) {
              return new Response(JSON.stringify({ ok: true, url: targetUrl, skipped: "cache_is_markdown_only" }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
            const cacheUrl = new URL(targetUrl);
            cacheUrl.search = "";
            const cacheKey = new Request(cacheUrl.toString(), { method: "GET", headers: { "User-Agent": "bot-cache-normalized" } });
            await caches.default.put(cacheKey, new Response(content, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=604800" } }));
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
          const seen = new Set();
          for (let i = 0; i < urls.length; i++) {
            const u = urls[i];
            const purgeUrl = new URL(u);
            purgeUrl.search = "";
            const path = purgeUrl.pathname.replace(/\/+$/, "") || "/";
            for (const pathVariant of [path, path + "/"].filter((p) => p !== "//")) {
              purgeUrl.pathname = pathVariant;
              const urlStr = purgeUrl.toString();
              if (seen.has(urlStr)) continue;
              seen.add(urlStr);
              const key = new Request(urlStr, { method: "GET", headers: { "User-Agent": "bot-cache-normalized" } });
              if (await cache.delete(key)) purged++;
            }
          }
          return new Response(JSON.stringify({ purged }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: String(e && e.message) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      }
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/__prerender-store" && request.method === "POST" && env.PRERENDER_CACHE) {
      const secret = request.headers.get("X-Warm-Secret");
      if (!secret || !env.WARM_SECRET || secret !== env.WARM_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      try {
        const body = await request.json();
        const kvKey = body.key;
        const html = body.html;
        const metadata = body.metadata || {};
        if (!kvKey || typeof html !== "string") {
          return new Response(JSON.stringify({ error: "key and html required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const encoder = new TextEncoder();
        const blob = new Blob([encoder.encode(html)]);
        const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
        const gzipped = await new Response(stream).arrayBuffer();
        metadata.content_encoding = "gzip";
        await env.PRERENDER_CACHE.put(kvKey, gzipped, { metadata, expirationTtl: 86400 * 7 });
        return new Response(JSON.stringify({ ok: true, key: kvKey }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e && e.message) }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    // 1.5 Artifact (markdown) and Badge (PNG) by verification_token
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const artifactMatch = pathname.match(/^\/artifact\/([a-f0-9-]{36})$/i);
    if (artifactMatch) {
      const token = artifactMatch[1];
      const artifactFnUrl = (env.ARTIFACT_MARKDOWN_URL || "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-markdown") + "?token=" + encodeURIComponent(token);
      try {
        const artRes = await fetch(artifactFnUrl, { method: "GET", headers: { "Accept": "text/markdown" } });
        const body = await artRes.text();
        const artHdrs = new Headers();
        artHdrs.set("Content-Type", "text/markdown; charset=utf-8");
        artHdrs.set("Cache-Control", "public, max-age=3600, must-revalidate");
        return new Response(body, { status: artRes.status, headers: artHdrs });
      } catch (e) {}
    }
    const badgeMatch = pathname.match(/^\/badge\/([a-f0-9-]{36})$/i);
    if (badgeMatch) {
      const token = badgeMatch[1];
      const badgeFnUrl = (env.BADGE_IMAGE_URL || "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/badge-image") + "?token=" + encodeURIComponent(token);
      try {
        const badgeRes = await fetch(badgeFnUrl, { method: "GET" });
        if (badgeRes.ok) {
          const buf = await badgeRes.arrayBuffer();
          const badgeHdrs = new Headers();
          badgeHdrs.set("Content-Type", "image/png");
          badgeHdrs.set("Cache-Control", "public, max-age=86400");
          const link = badgeRes.headers.get("Link");
          if (link) badgeHdrs.set("Link", link);
          const ct = badgeRes.headers.get("X-Certification-Tier");
          if (ct) badgeHdrs.set("X-Certification-Tier", ct);
          const an = badgeRes.headers.get("X-Agent-Name");
          if (an) badgeHdrs.set("X-Agent-Name", an);
          return new Response(buf, { status: 200, headers: badgeHdrs });
        }
      } catch (e) {}
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
    if (!botType && (ua.includes('bot') || ua.includes('crawler'))) botType = 'unknown_bot';
    
    const isBot = botType !== null;
    const forceRefresh = request.headers.get("X-Force-Refresh") === "true";

    // 2b. Pre-rendered KV (CleanRoom-style full HTML for city/neighborhood list pages)
    function pathToKvKey(pathname) {
      const p = pathname.replace(/\/+$/, "") || "/";
      const parts = p.split("/").filter(Boolean);
      if (parts.length === 3 && parts[2] === "top10realestateagents") return "clean/" + parts[0] + "/" + parts[1];
      if (parts.length === 4 && parts[3] === "top10realestateagents") return "clean/" + parts[0] + "/" + parts[1] + "/" + parts[2];
      return null;
    }
    if (isBot && !forceRefresh && env.PRERENDER_CACHE) {
      const kvKey = pathToKvKey(url.pathname);
      if (kvKey) {
        try {
          const { value: cached, metadata: meta } = await env.PRERENDER_CACHE.getWithMetadata(kvKey, { type: "arrayBuffer", cacheTtl: 3600 });
          if (cached) {
            const hdrs = new Headers();
            hdrs.set("Content-Type", "text/html; charset=utf-8");
            hdrs.set("Content-Encoding", "gzip");
            hdrs.set("X-Prerender", "kv-cache");
            hdrs.set("Cache-Control", "public, max-age=3600");
            if (meta && meta.generated_at) hdrs.set("X-Generated-At", meta.generated_at);
            return new Response(cached, { status: 200, headers: hdrs });
          }
        } catch (e) {}
      }
    }

    // 3. Cache Key Normalization
    const cache = caches.default;
    const cacheUrl = new URL(url);
    cacheUrl.search = ''; 
    const cacheKey = new Request(cacheUrl.toString(), { 
      method: "GET", 
      headers: { 'User-Agent': 'bot-cache-normalized' } 
    });

    let cachedResponse = null;
    if (isBot && !forceRefresh) {
      cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const dateHeader = cachedResponse.headers.get("Date");
        const cacheAge = dateHeader ? (Date.now() - new Date(dateHeader).getTime()) / 1000 : 0;
        
        // SWR Trigger: If older than 24 hours, refresh in background
        if (cacheAge > 86400) {
          ctx.waitUntil(this.renderAndStore(request, env, cacheKey));
        }

        // Enqueue bot visit with Worker cache status (for analytics)
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
            cache_status: 'HIT',
            ray_id: request.headers.get("cf-ray") || null,
            host: url.hostname || null
          }));
        }

        const hitHdrs = new Headers(cachedResponse.headers);
        hitHdrs.set("X-Cache", "HIT");
        return new Response(cachedResponse.body, { status: cachedResponse.status, headers: hitHdrs });
      }
    }

    // --- ORIGIN CONFIGURATION ---
    const originUrl = new URL(request.url);
    originUrl.hostname = "list-wise-boost.vercel.app";
    originUrl.protocol = "https:";

    // 4. Fallback for non-bots
    if (!isBot) {
      const originHeaders = new Headers(request.headers);
      if (env.VERCEL_PROTECTION_BYPASS) originHeaders.set("x-vercel-protection-bypass", env.VERCEL_PROTECTION_BYPASS);
      return fetch(new Request(originUrl.toString(), { method: request.method, headers: originHeaders }));
    }

    // Bot cache MISS: try data endpoint first so cache serves real list content (not SPA shell)
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const pathSegments = path.split("/").filter(Boolean);
    const isListPath = pathSegments.length >= 3 && (
      pathSegments[pathSegments.length - 1] === "top10realestateagents" ||
      pathSegments[pathSegments.length - 1] === "best-real-estate-agents" ||
      pathSegments[pathSegments.length - 1]?.startsWith("best-real-estate-agents-")
    );
    const botListHtmlUrl = env.BOT_LIST_HTML_URL || "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/serve-bot-list-html";

    if (isListPath) {
      try {
        const dataRes = await fetch(botListHtmlUrl + "?path=" + encodeURIComponent(path), {
          method: "GET",
          headers: { "Accept": "text/html" },
        });
        if (dataRes.ok) {
          const body = await dataRes.text();
          if (body && (body.includes("ItemList") || body.includes("RealEstateAgent") || dataRes.headers.get("X-Bot-List") === "1")) {
            const dataHeaders = new Headers(dataRes.headers);
            dataHeaders.set("X-Cache", "MISS");
            dataHeaders.set("X-Render-Status", "BOT_LIST_HTML");
            const toCache = new Response(body, { status: 200, headers: dataHeaders });
            try {
              await caches.default.put(cacheKey, toCache.clone());
            } catch (e) {}
            return toCache;
          }
        }
      } catch (e) {
        console.warn("Bot list HTML fetch failed:", e && e.message);
      }
    }

    // Enqueue bot visit with Worker cache status before rendering
    if (env.NOTIFICATION_QUEUE) {
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
        cache_status: 'MISS',
        ray_id: request.headers.get("cf-ray") || null,
        host: url.hostname || null
      }));
    }

    return this.renderAndStore(request, env, cacheKey);
  },

  async renderAndStore(request, env, cacheKey) {
    let browser;
    const url = new URL(request.url);
    const originUrl = "https://list-wise-boost.vercel.app" + url.pathname;

    try {
      const sessions = await puppeteer.sessions(env.MYBROWSER);
      const reuseSession = sessions.find(s => !s.connectionId);
      
      browser = reuseSession 
        ? await puppeteer.connect(env.MYBROWSER, reuseSession.sessionId)
        : await puppeteer.launch(env.MYBROWSER, { keep_alive: 600000 });

      const page = await browser.newPage();
      
      // Set a strict local timeout (e.g., 20s) to stay under Worker limits
      page.setDefaultTimeout(20000); 
      page.setDefaultNavigationTimeout(20000);

      await page.setViewport({ width: 1920, height: 1080 });
      
      if (env.VERCEL_PROTECTION_BYPASS) {
        await page.setExtraHTTPHeaders({ "x-vercel-protection-bypass": env.VERCEL_PROTECTION_BYPASS });
      }

      // High-reliability navigation
      await page.goto(originUrl, { 
        waitUntil: "domcontentloaded", 
        timeout: 15000 
      });

      const isListPage = url.pathname.indexOf("top10realestateagents") !== -1;

      // List pages (city/neighborhood): wait for agent content so we don't cache hollow shells.
      // 45s so we usually get full content; SWR still serves stale then refreshes in background.
      const LIST_WAIT_MS = 45000;
      if (isListPage) {
        try {
          await Promise.race([
            page.waitForSelector('[itemtype*="RealEstateAgent"]', { timeout: LIST_WAIT_MS }),
            page.waitForFunction(function() {
              var main = document.querySelector("main");
              if (!main) return false;
              var textLen = (main.textContent || "").length;
              var scripts = document.querySelectorAll('script[type="application/ld+json"]');
              for (var i = 0; i < scripts.length; i++) {
                if ((scripts[i].textContent || "").indexOf("ItemList") !== -1 && textLen > 15000) return true;
              }
              return false;
            }, { timeout: LIST_WAIT_MS })
          ]);
        } catch (listWaitErr) {
          console.warn("List content wait timed out, capturing anyway.");
        }
      }

      // RACE CONDITION: Wait for any valid content indicator (non-list or fallback)
      if (!isListPage) {
        try {
          await Promise.race([
            page.waitForSelector('[data-artifact-id]', { timeout: 7000 }),
            page.waitForSelector('article', { timeout: 7000 }),
            page.waitForFunction(() => document.querySelector('main')?.textContent?.length > 800, { timeout: 5000 })
          ]);
        } catch (selectorError) {
          console.warn("Artifact markers missing, attempting capture anyway.");
        }
      }

      const extracted = await page.evaluate(function extractArtifact() {
        function getText(el) {
          if (!el) return "";
          return (el.textContent || el.innerText || "").trim().replace(/\s+/g, " ");
        }
        var root = document.querySelector("[data-artifact-id]") || document.querySelector("article.artifact-page") || document.querySelector("article") || document.querySelector("main");
        if (!root) return null;
        var title = getText(root.querySelector("h1"));
        var sections = [];
        var h2s = root.querySelectorAll("h2");
        for (var i = 0; i < h2s.length; i++) {
          var h2 = h2s[i];
          var header = getText(h2);
          if (!header) continue;
          var content = { type: "text", value: "" };
          var next = h2.nextElementSibling;
          if (next) {
            if (next.tagName === "BLOCKQUOTE") {
              content = { type: "blockquote", value: getText(next) };
            } else if (next.tagName === "TABLE") {
              var rows = [];
              var thead = next.querySelector("thead tr");
              if (thead) {
                var headers = [];
                thead.querySelectorAll("th, td").forEach(function (c) { headers.push(getText(c)); });
                rows.push(headers);
              }
              next.querySelectorAll("tbody tr").forEach(function (tr) {
                var cells = [];
                tr.querySelectorAll("td, th").forEach(function (c) { cells.push(getText(c)); });
                if (cells.length) rows.push(cells);
              });
              content = { type: "table", value: rows };
            } else if (next.tagName === "UL") {
              var items = [];
              next.querySelectorAll("li").forEach(function (li) { items.push(getText(li)); });
              content = { type: "list", value: items };
            } else if (next.tagName === "P" || next.tagName === "DIV") {
              content = { type: "text", value: getText(next) };
            }
          }
          sections.push({ header: header, content: content });
        }
        return { title: title, sections: sections };
      });

      const html = await page.content();
      await browser.disconnect();

      let markdown = "";
      if (extracted && extracted.sections && extracted.sections.length > 0) {
        const escapePipe = (s) => (s || "").replace(/\|/g, "\\|");
        markdown = "# " + (extracted.title || "Intelligence Artifact") + "\n\n";
        for (let i = 0; i < extracted.sections.length; i++) {
          const s = extracted.sections[i];
          markdown += "## `" + s.header + "`\n\n";
          if (s.content.type === "blockquote") {
            markdown += "> " + (s.content.value || "").replace(/\n/g, "\n> ") + "\n\n";
          } else if (s.content.type === "table" && s.content.value && s.content.value.length > 0) {
            const rows = s.content.value;
            const colCount = rows[0] ? rows[0].length : 0;
            const sep = "|" + Array(colCount).fill("---").join("|") + "|";
            markdown += "| " + (rows[0] || []).map(escapePipe).join(" | ") + " |\n";
            markdown += sep + "\n";
            for (let r = 1; r < rows.length; r++) {
              markdown += "| " + (rows[r] || []).map(escapePipe).join(" | ") + " |\n";
            }
            markdown += "\n";
          } else if (s.content.type === "list" && s.content.value && s.content.value.length > 0) {
            s.content.value.forEach((item) => (markdown += "- " + item + "\n"));
            markdown += "\n";
          } else {
            markdown += (s.content.value || "") + "\n\n";
          }
        }
      }

      if (!markdown || markdown.length < 200) {
        const bodyMatch = html && html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const bodyText = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
        if (bodyText.length > 300) {
          markdown = "# " + (extracted && extracted.title ? extracted.title : "Intelligence Artifact") + "\n\n" + bodyText;
        } else if (html && html.length > 5000) {
          markdown = "# Fallback\n\nContent could not be fully extracted as artifact. Page length: " + html.length + " chars.";
        }
      }

      if (!markdown || markdown.length < 50) throw new Error("Invalid or empty render result.");

      const response = new Response(markdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "X-Cache": "MISS",
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=31536000"
        }
      });
      // Don't cache hollow list pages (no agents/ItemList or too small)
      const shouldCacheList = !isListPage || (html.length >= 50000 && html.indexOf("ItemList") !== -1);
      if (shouldCacheList) {
        await caches.default.put(cacheKey, response.clone());
      }
      return response;

    } catch (err) {
      // CRITICAL: Cleanup browser resources on ANY failure to avoid usage leaks
      if (browser) await browser.disconnect();
      console.error("Puppeteer Render Failed:", err.message);

      // EMERGENCY FALLBACK: Serve raw origin content to prevent 500 errors
      const originHeaders = new Headers(request.headers);
      if (env.VERCEL_PROTECTION_BYPASS) {
        originHeaders.set("x-vercel-protection-bypass", env.VERCEL_PROTECTION_BYPASS);
      }

      const originResponse = await fetch(new Request(originUrl, { 
        method: "GET", 
        headers: originHeaders 
      }));

      const fallbackHeaders = new Headers(originResponse.headers);
      fallbackHeaders.set("X-Render-Status", "FAILED_FALLBACK");

      // Cache the origin response so the NEXT bot request gets a Worker HIT instead of re-failing render
      const bodyBytes = await originResponse.clone().arrayBuffer();
      const cacheHeaders = new Headers(fallbackHeaders);
      cacheHeaders.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      try {
        await caches.default.put(cacheKey, new Response(bodyBytes, { status: originResponse.status, headers: cacheHeaders }));
      } catch (putErr) {
        console.warn("Fallback cache put failed:", putErr && putErr.message);
      }

      return new Response(originResponse.body, {
        status: originResponse.status,
        headers: fallbackHeaders
      });
    }
  }
};
