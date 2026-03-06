/**
 * Export Arizona-only, active-only professionals to CSV for Smartlead/push.
 * Columns: Firstname, Lastname, Email, Phone, Lead Status, Magic Link (no unsubscribe_url).
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "fs";
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

const supabase = createClient(base, key);

function escapeCsv(val: string): string {
  if (val == null || val === "") return "";
  const s = String(val).replace(/"/g, '""');
  return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r") ? `"${s}"` : s;
}

async function fetchAll(): Promise<any[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("professionals")
      .select("id, name, email, phone, lead_status, verification_token")
      .eq("state_slug", "arizona")
      .eq("active", true)
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

const rows = await fetchAll();
const header = ["Firstname", "Lastname", "Email", "Phone", "Lead Status", "Magic Link"];
const lines = [header.map(escapeCsv).join(",")];

for (const p of rows) {
  const name = p.name ?? "";
  const parts = name.trim().split(/\s+/);
  const firstname = parts[0] ?? "";
  const lastname = parts.slice(1).join(" ") ?? "";
  const email = p.email ?? "";
  const phone = p.phone ?? "";
  const leadStatus = p.lead_status ?? "";
  const magicLink = p.verification_token
    ? `https://www.top10lists.us/dashboard/${p.verification_token}`
    : "";
  lines.push(
    [firstname, lastname, email, phone, leadStatus, magicLink].map(escapeCsv).join(",")
  );
}

const outPath = resolve(process.cwd(), "arizona-active-leads.csv");
writeFileSync(outPath, lines.join("\r\n"), "utf-8");
console.log(`Wrote ${rows.length} rows to ${outPath}`);
