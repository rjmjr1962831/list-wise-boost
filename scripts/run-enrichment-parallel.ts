#!/usr/bin/env npx tsx
/**
 * Orchestration script for parallel enrichment pipeline.
 *
 * Usage:
 *   npx tsx scripts/run-enrichment-parallel.ts --state CA --phase prequalify --workers 5
 *   npx tsx scripts/run-enrichment-parallel.ts --state CA --phase deep --workers 3
 *   npx tsx scripts/run-enrichment-parallel.ts --state CA --phase prequalify --service serper --workers 10
 *   npx tsx scripts/run-enrichment-parallel.ts --seed-only --state TX
 *   npx tsx scripts/run-enrichment-parallel.ts --promote  (phase 1 → phase 2 transition)
 *   npx tsx scripts/run-enrichment-parallel.ts --status    (show progress)
 *
 * Env vars (from .env):
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SERPER_KEYS (comma-separated)
 *   EXA_KEYS (comma-separated)
 *   MEMO23_KEYS (comma-separated)
 *   DEEPSEEK_KEY (single key)
 */

import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const state = getArg("state");
const phase = (getArg("phase") || "prequalify") as "prequalify" | "deep";
const service = getArg("service"); // optional: if not set, runs both serper + exa for prequalify, or memo23 + deepseek for deep
const numWorkers = parseInt(getArg("workers") || "5", 10);
const maxSpendCents = parseInt(getArg("budget") || "50000", 10); // $500 default
const batchSize = parseInt(getArg("batch-size") || "500", 10);

// Helpers
async function rpc(fn: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RPC ${fn} failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function query(table: string, params: string = ""): Promise<unknown[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Query ${table} failed: ${res.status}`);
  return res.json() as Promise<unknown[]>;
}

function getKeys(envName: string): string[] {
  const raw = process.env[envName] || "";
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

// ---------- Commands ----------

async function showStatus() {
  const rows = await query("enrichment_progress");
  console.log("\n📊 Enrichment Progress:\n");
  console.log(
    "State".padEnd(8) +
    "Phase".padEnd(14) +
    "Status".padEnd(12) +
    "Count".padStart(10) +
    "  Cost ($)"
  );
  console.log("-".repeat(60));
  for (const r of rows as Record<string, unknown>[]) {
    const cost = ((Number(r.total_cost_cents) || 0) / 100).toFixed(2);
    console.log(
      String(r.state).padEnd(8) +
      String(r.phase).padEnd(14) +
      String(r.status).padEnd(12) +
      String(r.count).padStart(10) +
      `  $${cost}`
    );
  }
  console.log();
}

async function seedState(st: string) {
  console.log(`🌱 Seeding enrichment_jobs for state: ${st}...`);
  const count = await rpc("seed_enrichment_jobs", { p_state: st });
  console.log(`   Seeded ${count} jobs.`);
}

async function promoteToDeep() {
  console.log("⬆️  Promoting prequalified licenses to deep phase...");
  const count = await rpc("promote_to_deep");
  console.log(`   Promoted ${count} jobs.`);
}

async function runWorkers() {
  if (!state) {
    console.error("--state is required for running workers");
    process.exit(1);
  }

  // Determine which services and keys to use
  interface WorkerConfig {
    service: string;
    keys: string[];
    rateLimit: number;
    maxWorkers: number;
  }

  const configs: WorkerConfig[] = [];

  if (service) {
    // Single service mode
    const keyMap: Record<string, string> = {
      serper: "SERPER_KEYS",
      exa: "EXA_KEYS",
      memo23: "MEMO23_KEYS",
      deepseek: "DEEPSEEK_KEY",
    };
    const rateLimits: Record<string, number> = {
      serper: 10,
      exa: 10,
      memo23: 3,
      deepseek: 10,
    };
    const keys = getKeys(keyMap[service] || "");
    if (keys.length === 0) {
      console.error(`No keys found for ${service}. Set ${keyMap[service]} in .env`);
      process.exit(1);
    }
    configs.push({
      service,
      keys,
      rateLimit: rateLimits[service] || 10,
      maxWorkers: service === "memo23" ? 3 : 10,
    });
  } else if (phase === "prequalify") {
    // Default: run serper + exa in parallel
    const serperKeys = getKeys("SERPER_KEYS");
    const exaKeys = getKeys("EXA_KEYS");
    if (serperKeys.length > 0) configs.push({ service: "serper", keys: serperKeys, rateLimit: 10, maxWorkers: 10 });
    if (exaKeys.length > 0) configs.push({ service: "exa", keys: exaKeys, rateLimit: 10, maxWorkers: 10 });
    if (configs.length === 0) {
      console.error("No SERPER_KEYS or EXA_KEYS found in .env");
      process.exit(1);
    }
  } else {
    // Deep phase: memo23 + deepseek
    const memo23Keys = getKeys("MEMO23_KEYS");
    const deepseekKey = process.env.DEEPSEEK_KEY || "";
    if (memo23Keys.length > 0) configs.push({ service: "memo23", keys: memo23Keys, rateLimit: 3, maxWorkers: 3 });
    if (deepseekKey) configs.push({ service: "deepseek", keys: [deepseekKey], rateLimit: 10, maxWorkers: 10 });
    if (configs.length === 0) {
      console.error("No MEMO23_KEYS or DEEPSEEK_KEY found in .env");
      process.exit(1);
    }
  }

  // Seed jobs first
  await seedState(state);

  // Launch workers
  const workerPromises: Promise<unknown>[] = [];
  const perServiceBudget = Math.floor(maxSpendCents / configs.length);

  for (const config of configs) {
    const workers = Math.min(numWorkers, config.maxWorkers, config.keys.length);
    const perWorkerBudget = Math.floor(perServiceBudget / workers);

    console.log(
      `\n🚀 Launching ${workers} ${config.service} workers (${config.keys.length} keys, budget: $${(perServiceBudget / 100).toFixed(2)})...`
    );

    for (let i = 0; i < workers; i++) {
      const workerId = `${config.service}-${i + 1}`;
      const apiKey = config.keys[i % config.keys.length]; // round-robin keys

      const body = {
        worker_id: workerId,
        phase,
        service: config.service,
        api_key: apiKey,
        batch_size: batchSize,
        rate_limit_per_second: config.rateLimit,
        max_spend_cents: perWorkerBudget,
      };

      console.log(`   → ${workerId} (key ...${apiKey.slice(-6)}, budget: $${(perWorkerBudget / 100).toFixed(2)})`);

      const p = fetch(
        `${SUPABASE_URL}/functions/v1/enrichment-worker`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      )
        .then(async (res) => {
          const result = await res.json();
          console.log(`   ✅ ${workerId} done:`, JSON.stringify(result));
          return result;
        })
        .catch((err) => {
          console.error(`   ❌ ${workerId} error:`, err.message);
        });

      workerPromises.push(p);
    }
  }

  // Monitor progress while workers run
  const monitorInterval = setInterval(async () => {
    try {
      await showStatus();
    } catch {
      // ignore monitoring errors
    }
  }, 30000);

  // Wait for all workers
  console.log("\n⏳ Waiting for all workers to complete...\n");
  await Promise.allSettled(workerPromises);
  clearInterval(monitorInterval);

  // Final status
  await showStatus();
  console.log("✅ All workers finished.");
}

// ---------- Main ----------

async function main() {
  if (hasFlag("status")) {
    await showStatus();
  } else if (hasFlag("seed-only")) {
    if (!state) {
      console.error("--state is required with --seed-only");
      process.exit(1);
    }
    await seedState(state);
  } else if (hasFlag("promote")) {
    await promoteToDeep();
  } else {
    await runWorkers();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
