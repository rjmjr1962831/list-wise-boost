/**
 * check-cache: Check worker cache health and repair broken entries.
 *
 * 1. Probes a fixed set of URLs as a bot (status, size, Content-Type, X-Cache, ItemList).
 * 2. Classifies each as healthy or broken (list pages need ItemList + min size; static need min size; status 200).
 * 3. Repairs: purges broken URLs via purge-worker-cache, then fetches each with X-Force-Refresh to re-render and cache.
 * 4. Returns a report.
 *
 * Invoke: POST https://.../functions/v1/check-cache
 * Body: {} or { "dryRun": true } to only check and report, no repair.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.top10lists.us";
const BOT_UA = "Googlebot/2.1 (+http://www.google.com/bot.html)";
const PROBE_TIMEOUT_MS = 55000;
const LIST_MIN_SIZE = 20000;   // list pages: require ItemList and at least this many chars
const STATIC_MIN_SIZE = 500;

const CHECK_URLS: { path: string; label: string; isList: boolean }[] = [
  { path: "/", label: "Home", isList: false },
  { path: "/about", label: "About", isList: false },
  { path: "/arizona", label: "Arizona", isList: false },
  { path: "/arizona/phoenix/top10realestateagents", label: "Phoenix list", isList: true },
  { path: "/california/los-angeles/top10realestateagents", label: "LA list", isList: true },
  { path: "/arizona/scottsdale/top10realestateagents", label: "Scottsdale list", isList: true },
  { path: "/arizona/tucson/top10realestateagents", label: "Tucson list", isList: true },
  { path: "/california/san-diego/top10realestateagents", label: "San Diego list", isList: true },
];

interface ProbeResult {
  path: string;
  label: string;
  isList: boolean;
  status: number;
  size: number;
  contentType: string;
  xCache: string;
  hasItemList: boolean;
  healthy: boolean;
  reason?: string;
}

function fullUrl(path: string): string {
  return path === "/" ? BASE_URL + "/" : BASE_URL + path;
}

async function probeUrl(path: string, label: string, isList: boolean, forceRefresh: boolean): Promise<ProbeResult> {
  const url = fullUrl(path);
  const headers: Record<string, string> = {
    "User-Agent": BOT_UA,
    "Accept": "text/html,text/markdown,*/*",
  };
  if (forceRefresh) headers["X-Force-Refresh"] = "true";

  let status = 0;
  let size = 0;
  let contentType = "";
  let xCache = "";
  let body = "";

  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(to);
    status = res.status;
    contentType = res.headers.get("Content-Type") ?? "";
    xCache = res.headers.get("X-Cache") ?? "";
    body = await res.text();
    size = body.length;
  } catch (e) {
    return {
      path,
      label,
      isList,
      status: 0,
      size: 0,
      contentType: "",
      xCache: "",
      hasItemList: false,
      healthy: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }

  const hasItemList = body.includes("ItemList");
  let healthy = true;
  let reason: string | undefined;

  if (status !== 200) {
    healthy = false;
    reason = `status ${status}`;
  } else if (isList) {
    if (!hasItemList || size < LIST_MIN_SIZE) {
      healthy = false;
      reason = hasItemList ? `size ${size} < ${LIST_MIN_SIZE}` : "missing ItemList";
    }
  } else {
    if (size < STATIC_MIN_SIZE) {
      healthy = false;
      reason = `size ${size} < ${STATIC_MIN_SIZE}`;
    }
  }

  return {
    path,
    label,
    isList,
    status,
    size,
    contentType: contentType.split(";")[0].trim(),
    xCache: xCache || "-",
    hasItemList,
    healthy,
    reason,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let dryRun = false;
  try {
    if (req.method === "POST" && req.body) {
      const body = await req.json() as { dryRun?: boolean };
      dryRun = body.dryRun === true;
    }
  } catch (_) {}

  const results: ProbeResult[] = [];
  for (const u of CHECK_URLS) {
    const r = await probeUrl(u.path, u.label, u.isList, false);
    results.push(r);
  }

  const healthyList = results.filter((r) => r.healthy);
  const brokenList = results.filter((r) => !r.healthy);
  const brokenUrls = brokenList.map((r) => fullUrl(r.path));

  let purged = 0;
  let repaired = 0;

  if (brokenUrls.length > 0 && !dryRun) {
    // Purge broken URLs from worker cache
    try {
      const purgeRes = await fetch(`${supabaseUrl}/functions/v1/purge-worker-cache`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ urls: brokenUrls }),
      });
      if (purgeRes.ok) {
        const data = (await purgeRes.json()) as { purged?: number };
        purged = data.purged ?? 0;
      }
    } catch (e) {
      console.error("Purge failed:", e);
    }

    // Trigger re-render for each broken URL so worker repopulates cache
    for (const u of brokenList) {
      const again = await probeUrl(u.path, u.label, u.isList, true);
      if (again.status === 200 && again.healthy) repaired++;
    }
  }

  const report = {
    success: true,
    dryRun,
    checked: results.length,
    healthy: healthyList.length,
    broken: brokenList.length,
    purged,
    repaired,
    results: results.map((r) => ({
      label: r.label,
      path: r.path,
      status: r.status,
      size: r.size,
      sizeKB: Math.round(r.size / 1024 * 10) / 10,
      contentType: r.contentType,
      xCache: r.xCache,
      hasItemList: r.isList ? r.hasItemList : undefined,
      healthy: r.healthy,
      reason: r.reason,
    })),
    summary: `${healthyList.length}/${results.length} healthy; ${brokenList.length} broken${dryRun ? " (dry run, no repair)" : `; purged ${purged}; repaired ${repaired}`}`,
  };

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
