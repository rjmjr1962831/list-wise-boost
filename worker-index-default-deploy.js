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
    if (url.pathname === "/__warm" && request.method === "POST") {
      const secret = request.headers.get("X-Warm-Secret");
      if (secret && env.WARM_SECRET && secret === env.WARM_SECRET) {
        try {
          const body = await request.json();
          const targetUrl = body.url;
          const content = body.html || body.content;
          const isMarkdown = body.format === "markdown" || (typeof content === "string" && content.includes("# ") && (content.includes("## `") || content.includes("REASONING_NUGGET")));
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

    // 3. Cache Key Normalization
    const cache = caches.default;
    const cacheUrl = new URL(url);
    cacheUrl.search = ''; 
    const cacheKey = new Request(cacheUrl.toString(), { 
      method: "GET", 
      headers: { 'User-Agent': 'bot-cache-normalized' } 
    });

    if (isBot && !forceRefresh) {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const dateHeader = cachedResponse.headers.get("Date");
        const cacheAge = dateHeader ? (Date.now() - new Date(dateHeader).getTime()) / 1000 : 0;
        
        // SWR Trigger: If older than 24 hours, refresh in background
        if (cacheAge > 86400) {
          ctx.waitUntil(this.renderAndStore(request, env, cacheKey));
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

      // RACE CONDITION: Wait for any valid content indicator
      try {
        await Promise.race([
          page.waitForSelector('[data-artifact-id]', { timeout: 7000 }),
          page.waitForSelector('article', { timeout: 7000 }),
          page.waitForFunction(() => document.querySelector('main')?.textContent?.length > 800, { timeout: 5000 })
        ]);
      } catch (selectorError) {
        console.warn("Artifact markers missing, attempting capture anyway.");
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
      await caches.default.put(cacheKey, response.clone());
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

      // Tag the response so you can identify failures in your logs
      const fallbackHeaders = new Headers(originResponse.headers);
      fallbackHeaders.set("X-Render-Status", "FAILED_FALLBACK");
      
      return new Response(originResponse.body, {
        status: originResponse.status,
        headers: fallbackHeaders
      });
    }
  }
};
