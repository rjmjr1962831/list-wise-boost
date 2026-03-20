/**
 * enrichment-worker — Parallel enrichment pipeline worker
 *
 * Handles all services (serper, exa, memo23, deepseek).
 * Claims batches atomically from enrichment_jobs table.
 * Respects rate limits and budget caps.
 *
 * POST body:
 * {
 *   worker_id: string,       // e.g. "serper-3"
 *   phase: "prequalify" | "deep",
 *   service: "serper" | "exa" | "memo23" | "deepseek",
 *   api_key: string,
 *   batch_size?: number,     // default 500
 *   rate_limit_per_second?: number,  // default 10
 *   max_spend_cents?: number // budget cap in cents, default 50000 ($500)
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

// Cost per call in cents
const COST_MAP: Record<string, number> = {
  serper: 0.3,    // $0.003
  exa: 0.3,       // $0.003
  memo23: 3.0,    // $0.03
  deepseek: 0.02, // $0.0002
};

interface WorkerParams {
  worker_id: string;
  phase: "prequalify" | "deep";
  service: "serper" | "exa" | "memo23" | "deepseek";
  api_key: string;
  batch_size: number;
  rate_limit_per_second: number;
  max_spend_cents: number;
}

interface EnrichmentJob {
  id: string;
  license_id: string;
  state: string;
  phase: string;
  status: string;
  serper_done: boolean;
  exa_done: boolean;
  memo23_done: boolean;
  deepseek_done: boolean;
  retry_count: number;
}

interface LicenseRecord {
  id: string;
  name: string;
  business_city: string;
  state: string;
  state_slug: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- API call functions ----------

async function callSerper(
  apiKey: string,
  name: string,
  city: string,
  state: string
): Promise<{ data: unknown; prequalSignal: boolean }> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: `${name} real estate agent ${city} ${state} reviews`,
    }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}: ${await res.text()}`);
  const data = await res.json();

  // Prequalification signal: check if organic results mention reviews/ratings
  const organic = data.organic || [];
  const hasReviewSignals = organic.some(
    (r: { title?: string; snippet?: string }) => {
      const text = `${r.title || ""} ${r.snippet || ""}`.toLowerCase();
      return (
        text.includes("review") ||
        text.includes("rating") ||
        text.includes("zillow") ||
        text.includes("realtor.com")
      );
    }
  );

  return { data, prequalSignal: hasReviewSignals };
}

async function callExa(
  apiKey: string,
  name: string,
  city: string,
  state: string
): Promise<{ data: unknown; prequalSignal: boolean }> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `${name} real estate ${city} ${state}`,
      num_results: 5,
      use_autoprompt: true,
    }),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}: ${await res.text()}`);
  const data = await res.json();

  // Prequalification: check if results include profile pages or press (not just spam)
  const results = data.results || [];
  const hasProfileOrPress = results.some((r: { url?: string }) => {
    const url = (r.url || "").toLowerCase();
    return (
      url.includes("zillow.com") ||
      url.includes("realtor.com") ||
      url.includes("redfin.com") ||
      url.includes("linkedin.com") ||
      url.includes(".gov") ||
      // Local press patterns
      url.includes("bizjournals.com") ||
      url.includes("patch.com")
    );
  });

  return { data, prequalSignal: hasProfileOrPress };
}

async function callMemo23(
  apiKey: string,
  name: string,
  city: string,
  state: string
): Promise<{ data: unknown }> {
  // Start Apify actor run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/memo23~zillow-scraper/runs?token=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchQuery: `${name} real estate agent ${city} ${state}`,
        maxResults: 1,
      }),
    }
  );
  if (!startRes.ok)
    throw new Error(`Memo23 start ${startRes.status}: ${await startRes.text()}`);
  const run = await startRes.json();
  const runId = run.data?.id;
  if (!runId) throw new Error("Memo23: no run ID returned");

  // Poll for completion (max 120 seconds)
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
    );
    const statusData = await statusRes.json();
    const st = statusData.data?.status;
    if (st === "SUCCEEDED") {
      // Fetch results
      const resultRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiKey}`
      );
      const items = await resultRes.json();
      return { data: items };
    }
    if (st === "FAILED" || st === "ABORTED") {
      throw new Error(`Memo23 run ${st}`);
    }
  }
  throw new Error("Memo23 timeout after 120s");
}

async function callDeepSeek(
  apiKey: string,
  name: string,
  rawData: unknown
): Promise<{ data: unknown }> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "You are a real estate agent profile synthesizer. Given raw data about an agent, produce a factual, concise bio (2-3 sentences), list of specialization tags, and notable achievements. Output valid JSON with keys: bio, specializations (array), achievements (array).",
        },
        {
          role: "user",
          content: `Agent name: ${name}\n\nRaw data:\n${JSON.stringify(rawData, null, 2)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { data };
}

// ---------- Main handler ----------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response("POST only", { status: 405, headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let params: WorkerParams;
  try {
    const body = await req.json();
    params = {
      worker_id: body.worker_id,
      phase: body.phase || "prequalify",
      service: body.service,
      api_key: body.api_key,
      batch_size: body.batch_size || 500,
      rate_limit_per_second: body.rate_limit_per_second || 10,
      max_spend_cents: body.max_spend_cents || 50000, // $500 default
    };
    if (!params.worker_id || !params.service || !params.api_key) {
      throw new Error("Missing required: worker_id, service, api_key");
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const delayMs = 1000 / params.rate_limit_per_second;
  const costPerCall = COST_MAP[params.service] || 0.3;
  let totalSpentCents = 0;
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  // Process batches until no more pending jobs or budget exceeded
  let batchCount = 0;
  const MAX_BATCHES = 20; // safety: max 20 batches per invocation (10,000 jobs)

  while (batchCount < MAX_BATCHES) {
    batchCount++;

    // Budget check
    if (totalSpentCents >= params.max_spend_cents) {
      break;
    }

    // Claim batch atomically
    const { data: batch, error: claimErr } = await supabase.rpc(
      "claim_enrichment_batch",
      {
        p_worker_id: params.worker_id,
        p_phase: params.phase,
        p_batch_size: Math.min(
          params.batch_size,
          Math.floor((params.max_spend_cents - totalSpentCents) / costPerCall)
        ),
      }
    );

    if (claimErr) {
      return new Response(
        JSON.stringify({ error: `Claim failed: ${claimErr.message}` }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const jobs: EnrichmentJob[] = batch || [];
    if (jobs.length === 0) break; // no more work

    // Fetch license data for all jobs in batch
    const licenseIds = jobs.map((j) => j.license_id);
    const { data: licenses } = await supabase
      .from("state_licenses")
      .select("id, name, business_city, state, state_slug")
      .in("id", licenseIds);

    const licenseMap = new Map<string, LicenseRecord>();
    (licenses || []).forEach((l: LicenseRecord) => licenseMap.set(l.id, l));

    // Process each job
    for (const job of jobs) {
      // Budget check per-job
      if (totalSpentCents + costPerCall > params.max_spend_cents) {
        // Release unclaimed
        await supabase
          .from("enrichment_jobs")
          .update({ status: "pending", worker_id: null, claimed_at: null })
          .eq("id", job.id);
        skipped++;
        continue;
      }

      const license = licenseMap.get(job.license_id);
      if (!license) {
        await supabase
          .from("enrichment_jobs")
          .update({ status: "skip", error: "License not found", completed_at: new Date().toISOString() })
          .eq("id", job.id);
        skipped++;
        continue;
      }

      try {
        let prequalSignal: boolean | undefined;

        if (params.service === "serper") {
          const result = await callSerper(
            params.api_key,
            license.name,
            license.business_city || "",
            license.state
          );
          prequalSignal = result.prequalSignal;

          // Update job
          const updateData: Record<string, unknown> = {
            serper_done: true,
            cost_cents: costPerCall,
          };

          // Check if both services done to evaluate prequalification
          if (job.exa_done) {
            updateData.prequalified = prequalSignal || job.prequalified;
            updateData.status = "complete";
            updateData.completed_at = new Date().toISOString();
          }

          await supabase
            .from("enrichment_jobs")
            .update(updateData)
            .eq("id", job.id);

        } else if (params.service === "exa") {
          const result = await callExa(
            params.api_key,
            license.name,
            license.business_city || "",
            license.state
          );
          prequalSignal = result.prequalSignal;

          const updateData: Record<string, unknown> = {
            exa_done: true,
            cost_cents: costPerCall,
          };

          if (job.serper_done) {
            updateData.prequalified = prequalSignal || job.prequalified;
            updateData.status = "complete";
            updateData.completed_at = new Date().toISOString();
          }

          await supabase
            .from("enrichment_jobs")
            .update(updateData)
            .eq("id", job.id);

          // Also update exa_prequalified on state_licenses
          if (prequalSignal) {
            await supabase
              .from("state_licenses")
              .update({ exa_prequalified: true })
              .eq("id", license.id);
          }

        } else if (params.service === "memo23") {
          const result = await callMemo23(
            params.api_key,
            license.name,
            license.business_city || "",
            license.state
          );

          await supabase
            .from("enrichment_jobs")
            .update({
              memo23_done: true,
              cost_cents: costPerCall,
              status: job.deepseek_done ? "complete" : undefined,
              completed_at: job.deepseek_done ? new Date().toISOString() : undefined,
            })
            .eq("id", job.id);

          // Store raw memo23 data on state_licenses if needed
          if (result.data && Array.isArray(result.data) && result.data.length > 0) {
            await supabase
              .from("state_licenses")
              .update({ memo23_data: result.data[0] })
              .eq("id", license.id);
          }

        } else if (params.service === "deepseek") {
          // Fetch existing enrichment data for synthesis
          const { data: licenseData } = await supabase
            .from("state_licenses")
            .select("*")
            .eq("id", license.id)
            .single();

          const result = await callDeepSeek(
            params.api_key,
            license.name,
            licenseData
          );

          await supabase
            .from("enrichment_jobs")
            .update({
              deepseek_done: true,
              cost_cents: costPerCall,
              status: job.memo23_done ? "complete" : undefined,
              completed_at: job.memo23_done ? new Date().toISOString() : undefined,
            })
            .eq("id", job.id);
        }

        totalSpentCents += costPerCall;
        processed++;

        // Rate limiting
        await sleep(delayMs);

      } catch (err) {
        failed++;
        const errMsg = (err as Error).message || "Unknown error";
        const newRetry = (job.retry_count || 0) + 1;

        await supabase
          .from("enrichment_jobs")
          .update({
            status: newRetry > 3 ? "failed" : "pending",
            error: errMsg,
            retry_count: newRetry,
            worker_id: newRetry > 3 ? job.worker_id : null,
            claimed_at: newRetry > 3 ? job.claimed_at : null,
          })
          .eq("id", job.id);

        // Brief pause on error before continuing
        await sleep(1000);
      }
    }
  }

  const result = {
    worker_id: params.worker_id,
    service: params.service,
    phase: params.phase,
    processed,
    failed,
    skipped,
    total_spent_cents: totalSpentCents,
    budget_remaining_cents: params.max_spend_cents - totalSpentCents,
    batches: batchCount,
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
