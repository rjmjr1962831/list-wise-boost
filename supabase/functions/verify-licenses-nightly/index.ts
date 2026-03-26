/**
 * verify-licenses-nightly — Nightly license verification for active professionals.
 *
 * For each state (AZ, CA), queries active professionals with a license_number,
 * verifies each against the state licensing board, updates license_status +
 * license_verified_at, and creates crm_tasks alerts when a license status
 * changes away from Active.
 *
 * Both AZ and CA use bulk CSV downloads (AZDRE CSV, CalDRE ZIP/CSV) parsed
 * into in-memory Maps for instant lookups — no per-agent HTTP scraping.
 *
 * Processes agents in batches of 50 for DB reads. 1-second delay between batches.
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

// ---- California: bulk CSV download ----
// CalDRE publishes a daily bulk CSV (~436K rows, ~73MB) as a ZIP at this URL.
// We download once, parse lic_number → status into a Map, then lookupCA
// becomes a simple Map.get() — no per-agent HTTP requests.
const CA_ZIP_URL = "https://secure.dre.ca.gov/datafile/CurrList.zip";

// Module-level map, populated by downloadCALicenseMap() before CA processing.
let caLicenseMap: Map<string, string> | null = null;

/**
 * Parse a single CSV line respecting quoted fields (handles commas inside quotes).
 * Returns an array of field values with quotes stripped.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Download the CalDRE ZIP, extract the CSV, and build a Map<lic_number, normalized_status>.
 * The ZIP contains CurrList.csv with columns:
 *   0: multiple_license_ind, 1: lastname, 2: firstname, 3: suffix,
 *   4: lic_number, 5: lic_type, 6: lic_status, ...
 * Statuses: "Licensed" and "Licensed NBA" → "Active"; others preserved as-is.
 */
async function downloadCALicenseMap(): Promise<Map<string, string>> {
  console.log("[CA] Downloading bulk license ZIP from CalDRE...");
  const t0 = Date.now();

  const res = await fetch(CA_ZIP_URL, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) {
    throw new Error(`[CA] ZIP download failed: HTTP ${res.status}`);
  }

  // Read the ZIP into memory and decompress
  const zipBytes = new Uint8Array(await res.arrayBuffer());

  // --- Minimal ZIP extraction for a single-file archive ---
  // Find the first local file header (PK\x03\x04), skip to compressed data,
  // and inflate it. CurrList.zip contains a single deflated CSV.
  const view = new DataView(zipBytes.buffer);

  // Local file header signature = 0x04034b50
  if (view.getUint32(0, true) !== 0x04034b50) {
    throw new Error("[CA] Not a valid ZIP file");
  }
  const compressionMethod = view.getUint16(8, true);
  const compressedSize = view.getUint32(18, true);
  const fnameLen = view.getUint16(26, true);
  const extraLen = view.getUint16(28, true);
  const dataOffset = 30 + fnameLen + extraLen;
  const compressedData = zipBytes.slice(dataOffset, dataOffset + compressedSize);

  let csvText: string;
  if (compressionMethod === 0) {
    // Stored (no compression)
    csvText = new TextDecoder().decode(compressedData);
  } else if (compressionMethod === 8) {
    // Deflate — use DecompressionStream (available in Deno)
    const ds = new DecompressionStream("raw");
    const writer = ds.writable.getWriter();
    writer.write(compressedData);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((a, c) => a + c.length, 0);
    const full = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) {
      full.set(c, off);
      off += c.length;
    }
    csvText = new TextDecoder().decode(full);
  } else {
    throw new Error(`[CA] Unsupported ZIP compression method: ${compressionMethod}`);
  }

  const dlElapsed = Date.now() - t0;
  console.log(`[CA] ZIP downloaded and decompressed in ${dlElapsed}ms`);

  // Parse CSV into map
  const map = new Map<string, string>();
  const lines = csvText.split("\n");

  // Skip header row (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 7) continue;

    const licNumber = fields[4].trim();
    const licStatus = fields[6].trim();

    if (licNumber) {
      // Normalize CalDRE "Licensed" / "Licensed NBA" to our standard "Active"
      const normalized = licStatus.toLowerCase().startsWith("licensed")
        ? "Active"
        : licStatus;
      map.set(licNumber, normalized);
    }
  }

  const elapsed = Date.now() - t0;
  console.log(`[CA] CSV parsed: ${map.size} licenses in ${elapsed}ms`);
  return map;
}

// ---- California lookup (Map-based) ----
function lookupCA(licenseNumber: string): Promise<string | null> {
  if (!caLicenseMap) {
    return Promise.resolve(null);
  }
  const trimmed = licenseNumber.trim();
  const status = caLicenseMap.get(trimmed) ?? null;
  return Promise.resolve(status);
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

      // Download bulk CSV once before processing any agents in this state
      if (state === "AZ") {
        try {
          azLicenseMap = await downloadAZLicenseMap();
        } catch (err) {
          console.error("[AZ] Failed to download license CSV:", err);
          stats.errors++;
          // Skip AZ entirely if CSV download fails — don't de-list everyone
          continue;
        }
      } else if (state === "CA") {
        try {
          caLicenseMap = await downloadCALicenseMap();
        } catch (err) {
          console.error("[CA] Failed to download license ZIP:", err);
          stats.errors++;
          // Skip CA entirely if ZIP download fails — don't de-list everyone
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
