/**
 * Run campaign-life-lock for real (sends emails).
 * Run: npx tsx scripts/run-campaign-life-lock.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnv();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://wiotrvoirdgzfacuuiem.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Running campaign-life-lock (sending emails)...\n");

  const { data, error } = await supabase.functions.invoke("campaign-life-lock", {
    body: {},
  });

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  if ((data as { error?: string })?.error) {
    console.error("Function error:", (data as { error: string }).error);
    process.exit(1);
  }

  const r = data as { dry_run?: boolean; sent?: number; results?: any[]; message?: string };
  console.log("sent:", r.sent ?? 0);
  if (r.message) console.log("message:", r.message);
  if (r.results?.length) {
    r.results.forEach((x: any, i: number) => {
      console.log(`  ${i + 1}. ${x.account}: sent=${x.sent}${x.error ? ` error: ${x.error}` : ""}`);
    });
  }
}

main();
