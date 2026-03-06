/**
 * Read a log file (JSON array or .jsonl) and POST it to the ingest-request-logs Edge Function.
 * Option 2: run the batch file via the HTTP endpoint instead of inserting from the CLI script.
 *
 * Usage: npx tsx scripts/call-ingest-request-logs.ts <path-to-logs.jsonl or .json>
 *
 * Requires .env with SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) and VITE_SUPABASE_URL/SUPABASE_URL.
 */

import { readFileSync } from "fs";

interface LogEntry {
  url?: string;
  path?: string;
  user_agent?: string;
  timestamp?: string;
  [key: string]: unknown;
}

function loadEnv(): void {
  try {
    const env = readFileSync(".env", "utf-8");
    for (const line of env.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      )
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  } catch {
    /* no .env */
  }
}
loadEnv();

const baseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://wiotrvoirdgzfacuuiem.supabase.co";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

function parseLogEntries(filePath: string): LogEntry[] {
  const raw = readFileSync(filePath, "utf-8").trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const first = lines[0].trim();
  if (first.startsWith("[")) {
    const arr = JSON.parse(raw) as LogEntry[];
    return Array.isArray(arr) ? arr : [];
  }
  const entries: LogEntry[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as LogEntry;
      if (obj && (obj.url != null || obj.path != null)) entries.push(obj);
    } catch {
      /* skip */
    }
  }
  return entries;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/call-ingest-request-logs.ts <path-to-logs.jsonl or .json>");
    process.exit(1);
  }
  if (!key) {
    console.error("Need SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
  }

  const entries = parseLogEntries(filePath);
  console.log(`Read ${entries.length} entries from ${filePath}. POSTing to ingest-request-logs...`);

  const url = `${baseUrl}/functions/v1/ingest-request-logs`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ entries }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Error:", res.status, data.error || data);
    process.exit(1);
  }
  console.log("Result:", data);
}

main();
