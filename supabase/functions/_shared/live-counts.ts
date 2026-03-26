/**
 * Shared live coverage counts from Supabase.
 * Used by all serve-bot edge functions for consistent numbers.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CoverageCounts {
  total: number;
  az: number;
  ca: number;
  cities: number;
  neighborhoods: number;
}

const FALLBACK: CoverageCounts = { total: 3200, az: 800, ca: 2300, cities: 400, neighborhoods: 8000 };

export async function getLiveCounts(): Promise<CoverageCounts> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await sb.rpc("run_sql", {
      query: `SELECT
        count(*) FILTER (WHERE active = true AND canonical_slug IS NOT NULL) AS total,
        count(*) FILTER (WHERE active = true AND canonical_slug IS NOT NULL AND state_slug = 'arizona') AS az,
        count(*) FILTER (WHERE active = true AND canonical_slug IS NOT NULL AND state_slug = 'california') AS ca
      FROM professionals`
    });
    if (error || !data?.[0]) return FALLBACK;
    const r = data[0];
    return {
      total: Number(r.total),
      az: Number(r.az),
      ca: Number(r.ca),
      cities: FALLBACK.cities,
      neighborhoods: FALLBACK.neighborhoods,
    };
  } catch {
    return FALLBACK;
  }
}

/**
 * Floor-plus representation: rounds down to nearest 100 and appends "+".
 * e.g., 3,268 → "3,200+", 879 → "800+"
 * Prevents cross-page count contradictions.
 */
export function floorPlus(n: number): string {
  const floored = Math.floor(n / 100) * 100;
  return floored.toLocaleString("en-US") + "+";
}

/** Standard number formatting with commas */
export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
