/**
 * verify-licenses-nightly — Nightly license verification for active professionals.
 *
 * For each state (AZ, CA), queries active professionals with a license_number,
 * verifies each against the state licensing board via individual lookups,
 * updates license_status + license_verified_at, and creates crm_tasks alerts
 * when a license status changes away from Active.
 *
 * Processes agents in batches of 50, 10 concurrent lookups per batch,
 * 1-second delay between batches. 10-second timeout per lookup.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const BATCH_SIZE = 50;
const CONCURRENCY = 10;
const LOOKUP_TIMEOUT_MS = 10_000;
const INTER_BATCH_DELAY_MS = 1_000;

interface StateStats {
  total: number;
  checked: number;
  active: number;
  changed: number;
  errors: number;
}

interface Alert {
  name: string;
  license: string;
  state: string;
  old: string;
  new: string;
}

// ---- Arizona: bulk CSV download ----
// AZDRE publishes a full licensee CSV (~220K rows, ~50MB) at this URL.
// We download it once, parse license_number → status into a Map, then
// lookupAZ becomes a simple Map.get() — no per-agent HTTP requests.
const AZ_CSV_URL = "https://services.azre.gov/PdbWeb/List/DownloadList/1";

// Module-level map, populated by downloadAZLicenseMap() before AZ processing.
let azLicenseMap: Map<string, string> | null = null;

/**
 * Download the AZDRE CSV and build a Map<trimmed_license_number, LicStatus>.
 * Streams the response and parses line-by-line to keep memory lean — we only
 * store the two fields we need (columns 5 and 8: LicNumber, LicStatus).
 */
async function downloadAZLicenseMap(): Promise<Map<string, string>> {
  console.log("[AZ] Downloading bulk license CSV from AZDRE...");
  const t0 = Date.now();

  const res = await fetch(AZ_CSV_URL, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) {
    throw new Error(`[AZ] CSV download failed: HTTP ${res.status}`);
  }

  const map = new Map<string, string>();
  const text = await res.text();
  const lines = text.split("\n");

  // Skip header row (index 0), process data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 10) continue;

    // CSV fields are quoted: "val1","val2",...
    // We need field index 5 (LicNumber) and 8 (LicStatus) — 0-based.
    // Simple quoted-CSV parse: split on "," boundary
    const fields = line.split('","');
    if (fields.length < 10) continue;

    // First field has leading quote, last field has trailing quote
    const licNumber = (fields[5] || "").replace(/"/g, "").trim();
    const licStatus = (fields[8] || "").replace(/"/g, "").trim();

    if (licNumber) {
      map.set(licNumber, licStatus);
    }
  }

  const elapsed = Date.now() - t0;
  console.log(`[AZ] CSV parsed: ${map.size} licenses in ${elapsed}ms`);
  return map;
}

// ---- Arizona lookup (Map-based) ----
function lookupAZ(licenseNumber: string): Promise<string | null> {
  if (!azLicenseMap) {
    return Promise.resolve(null);
  }
  const trimmed = licenseNumber.trim();
  const status = azLicenseMap.get(trimmed) ?? null;
  return Promise.resolve(status);
}

// ---- California lookup ----
async function lookupCA(licenseNumber: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const form = new URLSearchParams({
      LICENSEE_NAME: "",
      CITY_STATE: "",
      LICENSE_ID: licenseNumber,
    });
    const res = await fetch(
      "https://www2.dre.ca.gov/PublicASP/pplinfo.asp?start=1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
          "Referer": "https://www2.dre.ca.gov/PublicASP/pplinfo.asp",
          "Accept": "text/html,application/xhtml+xml",
        },
        body: form.toString(),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) return null;
    const html = await res.text();
    // CalDRE pages show "License Status:" followed by the status
    const statusMatch = html.match(/License\s+Status\s*:?\s*<[^>]*>\s*(Licensed|Restricted|Revoked|Expired|Suspended|Inactive|Cancelled)/i)
      || html.match(/Status\s*:?\s*<[^>]*>\s*(Licensed|Restricted|Revoked|Expired|Suspended|Inactive|Cancelled)/i)
      || html.match(/\b(Licensed|Restricted|Revoked|Expired|Suspended|Inactive|Cancelled)\b/i);
    if (!statusMatch) return null;
    // Normalize CalDRE "Licensed" to our standard "Active"
    const raw = statusMatch[1];
    return raw.toLowerCase() === "licensed" ? "Active" : raw;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Lookup dispatcher ----
function lookupLicense(state: string, licenseNumber: string): Promise<string | null> {
  switch (state) {
    case "AZ": return lookupAZ(licenseNumber);
    case "CA": return lookupCA(licenseNumber);
    default: return Promise.resolve(null);
  }
}

// ---- Run concurrent lookups with limited concurrency ----
async function runConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function isStatusChangeAlert(oldStatus: string | null, newStatus: string): boolean {
  const norm = (s: string | null) => (s || "Active").toLowerCase();
  return norm(oldStatus) === "active" && norm(newStatus) !== "active";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const statsByState: Record<string, StateStats> = {};
  const alerts: Alert[] = [];

  try {
    for (const state of ["AZ", "CA"]) {
      const stats: StateStats = { total: 0, checked: 0, active: 0, changed: 0, errors: 0 };
      statsByState[state] = stats;

      // For AZ: download the bulk CSV once before processing any agents
      if (state === "AZ") {
        try {
          azLicenseMap = await downloadAZLicenseMap();
        } catch (err) {
          console.error("[AZ] Failed to download license CSV:", err);
          stats.errors++;
          // Skip AZ entirely if CSV download fails — don't de-list everyone
          continue;
        }
      }

      // Fetch all active professionals with a license_number in this state
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        // Only fetch agents not yet verified today (resumable across invocations)
        const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
        const { data: batch, error } = await supabase
          .from("professionals")
          .select("id, name, license_number, license_status, state_slug")
          .eq("active", true)
          .eq("state_slug", state === "AZ" ? "arizona" : "california")
          .not("license_number", "is", null)
          .neq("license_number", "")
          .neq("license_number", "N/A")
          .neq("license_number", "Not Provided")
          .or(`license_verified_at.is.null,license_verified_at.lt.${cutoff}`)
          .range(offset, offset + BATCH_SIZE - 1)
          .order("id", { ascending: true });

        if (error) {
          console.error(`Error fetching ${state} agents at offset ${offset}:`, error.message);
          stats.errors++;
          break;
        }

        if (!batch || batch.length === 0) {
          hasMore = false;
          break;
        }

        stats.total += batch.length;
        if (batch.length < BATCH_SIZE) hasMore = false;

        // Verify this batch: 10 concurrent lookups
        const results = await runConcurrent(batch, CONCURRENCY, async (agent: any) => {
          try {
            const newStatus = await lookupLicense(state, agent.license_number);
            return { agent, newStatus };
          } catch (err) {
            console.error(`Lookup failed for ${agent.name} (${agent.license_number}):`, err);
            return { agent, newStatus: null };
          }
        });

        // Process results and update DB
        for (const { agent, newStatus } of results) {
          if (newStatus === null) {
            stats.errors++;
            // De-list agents whose license cannot be verified
            await supabase
              .from("professionals")
              .update({ active: false })
              .eq("id", agent.id);
            await supabase.from("crm_tasks").insert({
              professional_id: agent.id,
              task_type: "license_review",
              title: `License unverifiable — de-listed: ${agent.name}`,
              description: `License #${agent.license_number} (${state}) could not be verified against state board. Agent de-listed pending manual review.`,
              status: "pending",
              priority: "high",
            });
            alerts.push({
              name: agent.name,
              license: agent.license_number,
              state,
              old: agent.license_status || "Active",
              new: "Unverifiable — de-listed",
            });
            continue;
          }

          stats.checked++;

          if (newStatus.toLowerCase() === "active") {
            stats.active++;
          }

          const oldStatus = agent.license_status || "Active";
          const statusChanged = oldStatus.toLowerCase() !== newStatus.toLowerCase();

          // Update the professional's license_status and license_verified_at
          const { error: updErr } = await supabase
            .from("professionals")
            .update({
              license_status: newStatus,
              license_verified_at: new Date().toISOString(),
            })
            .eq("id", agent.id);

          if (updErr) {
            console.error(`Update failed for ${agent.name}:`, updErr.message);
          }

          // Handle status change FROM Active to something else
          if (statusChanged && isStatusChangeAlert(oldStatus, newStatus)) {
            stats.changed++;
            alerts.push({
              name: agent.name,
              license: agent.license_number,
              state,
              old: oldStatus,
              new: newStatus,
            });

            // De-list the agent (keep profile for "Verified Inactive" signal to AI)
            await supabase
              .from("professionals")
              .update({ active: false })
              .eq("id", agent.id);

            await supabase.from("crm_tasks").insert({
              professional_id: agent.id,
              task_type: "license_alert",
              title: `License ${newStatus}: ${agent.name} — de-listed`,
              description: `License #${agent.license_number} (${state}) changed from ${oldStatus} to ${newStatus}. Agent de-listed. Profile retained with "Verified Inactive" status for AI safety signal. Verified ${new Date().toISOString()}.`,
              status: "pending",
              priority: "high",
            });
          }

          // NOTE: Safety net for pre-existing non-Active statuses REMOVED.
          // The AZDRE scraper returns "Expired" for many valid AZ licenses
          // (likely scraping the wrong field or interpreting renewal status).
          // Do NOT auto-de-list based on stored license_status alone.
          // Only de-list on verified status CHANGE from Active to non-Active.
        }

        offset += BATCH_SIZE;

        // Inter-batch delay to avoid rate limiting
        if (hasMore) {
          await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
        }
      }

      console.log(`${state} complete: ${JSON.stringify(stats)}`);
    }

    const elapsed = Date.now() - t0;
    return new Response(
      JSON.stringify({
        success: true,
        stats: statsByState,
        alerts,
        elapsed_ms: elapsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("verify-licenses-nightly error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        stats: statsByState,
        alerts,
        elapsed_ms: Date.now() - t0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
