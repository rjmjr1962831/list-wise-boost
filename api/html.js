/**
 * Minimal HTML proxy — fixes Supabase gateway forcing text/plain on edge functions.
 * No caching, no logging (edge functions handle their own via logBotVisit).
 */
export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1';

const ALLOWED = new Set([
  'serve-bot-state-html',
  'serve-bot-list-html',
  'serve-bot-agent-html',
  'serve-bot-content-html',
  'serve-bot-crawl-stats-html',
  'serve-bot-founder-html',
  'serve-bot-home-html',
  'serve-bot-pages-html',
  'serve-bot-qa-html',
]);

export default async function handler(req) {
  const url = new URL(req.url);
  const fn = url.searchParams.get('fn');
  const path = url.searchParams.get('path');

  if (!fn || !path || !ALLOWED.has(fn)) {
    return new Response('Bad request', { status: 400 });
  }

  // Build upstream URL with all query params except fn
  const upstream = new URL(`${SUPABASE_URL}/${fn}`);
  for (const [k, v] of url.searchParams) {
    if (k !== 'fn') upstream.searchParams.set(k, v);
  }

  const ua = req.headers.get('user-agent') || '';

  const res = await fetch(upstream.toString(), {
    headers: { 'x-forwarded-user-agent': ua },
  });

  const html = await res.text();

  return new Response(html, {
    status: res.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Rendered': fn,
    },
  });
}
