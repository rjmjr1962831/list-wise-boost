/**
 * Export active agents that have confirmed their profiles.
 * Confirmed = funnel_status in (accuracy_confirmed, approved, edit_complete, completed, subscribed, profile_approved)
 *   OR funnel_event (accuracy_confirmed, profile_approved, profile_edited).
 * Columns: Firstname, Lastname, Email, Phone, State, City, Magic Link.
 * Run: npx tsx scripts/export-active-confirmed-agents-csv.ts
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

const CONFIRMED_FUNNEL_STATUSES = ["accuracy_confirmed", "approved", "edit_complete", "completed", "subscribed", "profile_approved", "profile_edited"];
const CONFIRMED_FUNNEL_EVENTS = ["accuracy_confirmed", "profile_approved", "profile_edited"];

async function getConfirmedDateMap(): Promise<Map<string, string>> {
  const { data: events, error } = await supabase
    .from("funnel_events")
    .select("professional_id, created_at")
    .in("event_name", CONFIRMED_FUNNEL_EVENTS);

  if (error) throw error;
  const map = new Map<string, string>();
  for (const e of events ?? []) {
    const existing = map.get(e.professional_id);
    const createdAt = e.created_at ? new Date(e.created_at).toISOString().slice(0, 10) : "";
    if (!existing || (createdAt && createdAt < existing)) map.set(e.professional_id, createdAt);
  }
  return map;
}

async function fetchAll(): Promise<{ rows: any[]; ids: string[] }> {
  const { data: byStatus, error: err1 } = await supabase
    .from("professionals")
    .select("id")
    .eq("active", true)
    .in("funnel_status", CONFIRMED_FUNNEL_STATUSES);

  const { data: eventRows, error: err2 } = await supabase
    .from("funnel_events")
    .select("professional_id")
    .in("event_name", CONFIRMED_FUNNEL_EVENTS);

  if (err1 || err2) throw err1 || err2;

  const ids = new Set<string>();
  (byStatus ?? []).forEach((r: any) => ids.add(r.id));
  (eventRows ?? []).forEach((r: any) => ids.add(r.professional_id));
  const idList = [...ids];
  if (!idList.length) return { rows: [], ids: [] };

  const pageSize = 1000;
  const all: any[] = [];
  for (let i = 0; i < idList.length; i += pageSize) {
    const chunk = idList.slice(i, i + pageSize);
    const { data, error } = await supabase
      .from("professionals")
      .select("id, name, email, phone, state_slug, business_city, verification_token")
      .eq("active", true)
      .in("id", chunk)
      .order("id");
    if (error) throw error;
    if (data?.length) all.push(...data);
  }
  const rows = all.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return { rows, ids: idList };
}

async function main() {
  const { rows, ids } = await fetchAll();
  const confirmedDates = await getConfirmedDateMap();
  const outPath = resolve(process.cwd(), "active-confirmed-agents.csv");

  const header = ["Firstname", "Lastname", "Email", "Phone", "State", "City", "Date Confirmed", "Magic Link"];
  const lines = [header.map(escapeCsv).join(",")];

  for (const p of rows) {
    const name = p.name ?? "";
    const parts = name.trim().split(/\s+/);
    const firstname = parts[0] ?? "";
    const lastname = parts.slice(1).join(" ") ?? "";
    const email = p.email ?? "";
    const phone = p.phone ?? "";
    const state = p.state_slug ?? "";
    const city = p.business_city ?? "";
    const dateConfirmed = confirmedDates.get(p.id) ?? "";
    const magicLink = p.verification_token
      ? `https://www.top10lists.us/dashboard/${p.verification_token}`
      : "";
    lines.push([firstname, lastname, email, phone, state, city, dateConfirmed, magicLink].map(escapeCsv).join(","));
  }

  writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`Exported ${rows.length} active agents with confirmed profiles to ${outPath}`);

  if (ids.length) {
    const { error } = await supabase
      .from("professionals")
      .update({ current_tier: "certified" })
      .in("id", ids);
    if (error) {
      console.error("Failed to update tier:", error.message);
    } else {
      console.log(`Updated ${ids.length} agents to tier: Certified`);
    }
  }
}

main();
