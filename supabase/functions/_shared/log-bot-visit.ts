/**
 * Shared fire-and-forget bot crawl logger.
 * Call logBotVisit() from any serve-bot-* edge function.
 * Non-awaited — adds zero latency to the response path.
 */

const BOT_PATTERNS: [string, RegExp][] = [
  ["ChatGPT-User", /chatgpt-user/i],
  ["OAI-SearchBot", /oai-searchbot/i],
  ["GPTBot", /gptbot/i],
  ["ClaudeBot", /claudebot/i],
  ["claude-web", /claude-web|anthropic-ai/i],
  ["PerplexityBot", /perplexitybot/i],
  ["YouBot", /youbot/i],
  ["Meta-ExternalAgent", /meta-externalagent/i],
  ["Googlebot", /googlebot(?!-image)/i],
  ["GoogleOther", /googleother/i],
  ["Google-Extended", /google-extended/i],
  ["Gemini-AI", /gemini-ai/i],
  ["Bingbot", /bingbot/i],
  ["Applebot", /applebot/i],
  ["AhrefsBot", /ahrefsbot/i],
  ["SEMrushBot", /semrushbot/i],
  ["DotBot", /dotbot/i],
  ["MJ12bot", /mj12bot/i],
  ["ByteSpider", /bytespider/i],
  ["CCBot", /ccbot/i],
  ["FacebookExternalHit", /facebookexternalhit/i],
  ["Twitterbot", /twitterbot/i],
  ["LinkedInBot", /linkedinbot/i],
  ["YandexBot", /yandexbot/i],
  ["Baiduspider", /baiduspider/i],
  ["DuckDuckBot", /duckduckbot/i],
  ["PetalBot", /petalbot/i],
  ["SERankingBot", /serankingbacklinksbot|seranking/i],
  ["TikTokSpider", /tiktokspider/i],
];

function detectBot(ua: string): string | null {
  for (const [name, pattern] of BOT_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  const lower = ua.toLowerCase();
  if (lower.includes("bot") || lower.includes("crawler") || lower.includes("spider")) {
    return "unknown_bot";
  }
  return null;
}

/**
 * Fire-and-forget insert into bot_crawl_logs.
 * Call without await — it runs in the background.
 *
 * @param sb - Supabase client (already initialized in the calling function)
 * @param req - The incoming request (for user-agent extraction)
 * @param pagePath - The clean page path (e.g. /arizona/phoenix/top10realestateagents)
 * @param agentId - Optional agent UUID (for profile/artifact pages)
 */
export function logBotVisit(
  sb: any,
  req: Request,
  pagePath: string,
  agentId?: string | null,
): void {
  // Prefer x-forwarded-user-agent (set by Vercel proxy) over direct user-agent
  const ua = req.headers.get("x-forwarded-user-agent") || req.headers.get("user-agent") || "";
  if (!ua) return;

  const botName = detectBot(ua);
  if (!botName) return;

  // Fire and forget — don't await
  sb.from("bot_crawl_logs")
    .insert({
      page_path: pagePath,
      user_agent: ua.slice(0, 500),
      bot_name: botName,
      crawled_at: new Date().toISOString(),
      agent_id: agentId || null,
    })
    .then(({ error }: any) => {
      if (error) console.error("[log-bot] insert error:", error.message);
    })
    .catch((e: any) => {
      console.error("[log-bot] unexpected error:", e?.message || e);
    });
}
