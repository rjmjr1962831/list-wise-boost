/**
 * Dry run: sequence-enroll with Arizona + private + listed (no enrollments created).
 */
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

const base =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://wiotrvoirdgzfacuuiem.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const url = base.replace(/\/$/, "") + "/functions/v1/sequence-enroll";
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    sequence_id: "3bed1ae8-61d9-49d8-8349-610e738c47d2",
    filters: { state_slug: "arizona", email_provider: "private" },
    dry_run: true,
  }),
});

const data = await res.json();
console.log("Dry run result:");
console.log(JSON.stringify(data, null, 2));
