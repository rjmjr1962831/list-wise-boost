/**
 * Shared coverage counts — reads from the daily snapshot in static_pages.
 *
 * The refresh-coverage-counts cron writes a JSON snapshot every 24h.
 * All edge functions read from this single row — one DB read, one source
 * of truth, consistent numbers across all surfaces.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CoverageCounts {
  total: number;
  az: number;
  ca: number;
  tx: number;
  cities: number;
  neighborhoods: number;
  updated_at: string;
}

const FALLBACK: CoverageCounts = {
  total: 3200, az: 800, ca: 2300, tx: 0,
  cities: 400, neighborhoods: 8000,
  updated_at: new Date().toISOString(),
};

export async function getLiveCounts(): Promise<CoverageCounts> {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await sb
      .from("static_pages")
      .select("html, rendered_at")
      .eq("slug", "coverage-counts")
      .single();

    if (error || !data?.html) return FALLBACK;

    const snapshot = JSON.parse(data.html);
    return {
      total: snapshot.agents?.total || FALLBACK.total,
      az: snapshot.agents?.az || FALLBACK.az,
      ca: snapshot.agents?.ca || FALLBACK.ca,
      tx: snapshot.agents?.tx || 0,
      cities: snapshot.cities?.total || FALLBACK.cities,
      neighborhoods: snapshot.neighborhoods?.total || FALLBACK.neighborhoods,
      updated_at: snapshot.updated_at || data.rendered_at || FALLBACK.updated_at,
    };
  } catch {
    return FALLBACK;
  }
}

/**
 * Floor-plus representation: rounds down to nearest 100 and appends "+".
 * e.g., 3,268 → "3,200+", 879 → "800+"
 */
export function floorPlus(n: number): string {
  const floored = Math.floor(n / 100) * 100;
  return floored.toLocaleString("en-US") + "+";
}

/** Standard number formatting with commas */
export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Format updated_at as human-readable date */
export function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return "recently";
  }
}
