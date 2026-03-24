import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXA_REGEX = /Exa suggested:\s*(.+)$/m;

function fuzzyNameMatch(zbFirst: string, zbLast: string, professionalName: string): boolean {
  if (!zbFirst && !zbLast) return true; // no ZB name data — accept
  const name = professionalName.toLowerCase();
  if (zbFirst && name.includes(zbFirst.toLowerCase())) return true;
  if (zbLast && name.includes(zbLast.toLowerCase())) return true;
  return false;
}

async function validateEmail(email: string, apiKey: string): Promise<{ valid: boolean; firstname: string; lastname: string }> {
  try {
    const res = await fetch(
      `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`
    );
    if (!res.ok) throw new Error(`ZeroBounce HTTP ${res.status}`);
    const data = await res.json();
    return {
      valid: data.status === "valid",
      firstname: data.firstname || "",
      lastname: data.lastname || "",
    };
  } catch (err) {
    console.error(`ZeroBounce error for ${email}:`, err);
    return { valid: false, firstname: "", lastname: "" };
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const zbApiKey = Deno.env.get("ZEROBOUNCE_API_KEY");

    if (!zbApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "ZEROBOUNCE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch all pending email_bounced tasks
    const { data: tasks, error: fetchErr } = await supabase
      .from("crm_tasks")
      .select("id, title, description, professional_id")
      .eq("status", "pending")
      .eq("task_type", "email_bounced");

    if (fetchErr) throw fetchErr;
    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, resolved: 0, skipped_no_suggestions: 0, skipped_no_valid: 0, details: [], elapsed_ms: Date.now() - start }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${tasks.length} pending email_bounced tasks`);

    let resolved = 0;
    let skippedNoSuggestions = 0;
    let skippedNoValid = 0;
    const details: Record<string, unknown>[] = [];

    // 2. Process sequentially
    for (const task of tasks) {
      const match = task.description?.match(EXA_REGEX);
      if (!match) {
        skippedNoSuggestions++;
        details.push({ name: task.title, status: "skipped", reason: "no Exa suggestions" });
        console.log(`[SKIP] ${task.title} — no Exa suggestions`);
        continue;
      }

      const suggestions = match[1].split(", ").map((e: string) => e.trim()).filter(Boolean);
      console.log(`[CHECK] ${task.title} — ${suggestions.length} suggestions`);

      // Get professional name for name matching
      let professionalName = task.title || "";

      // Extract old email from description for logging
      const oldEmailMatch = task.description?.match(/(?:for|to)\s+([\w.+-]+@[\w.-]+)/);
      const oldEmail = oldEmailMatch ? oldEmailMatch[1] : "unknown";

      let foundValid = false;

      for (const candidateEmail of suggestions) {
        const zb = await validateEmail(candidateEmail, zbApiKey);
        console.log(`  ${candidateEmail} → ${zb.valid ? "valid" : "invalid"} (${zb.firstname} ${zb.lastname})`);

        if (zb.valid) {
          // Name check
          if (!fuzzyNameMatch(zb.firstname, zb.lastname, professionalName)) {
            console.log(`  Name mismatch — skipping ${candidateEmail}`);
            await delay(500);
            continue;
          }

          // Update professional email and reset lead_status
          await supabase
            .from("professionals")
            .update({ email: candidateEmail, lead_status: "cold" })
            .eq("id", task.professional_id);

          // Mark task as completed
          await supabase
            .from("crm_tasks")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              notes: `Auto-resolved: Updated email to ${candidateEmail} (ZeroBounce verified)`,
            })
            .eq("id", task.id);

          resolved++;
          details.push({ name: task.title, old: oldEmail, new: candidateEmail, status: "resolved" });
          console.log(`[RESOLVED] ${task.title} → ${candidateEmail}`);
          foundValid = true;
          break;
        }

        await delay(500);
      }

      if (!foundValid) {
        skippedNoValid++;
        details.push({ name: task.title, status: "skipped", reason: "no valid suggestion" });
        console.log(`[SKIP] ${task.title} — no valid suggestion found`);
      }
    }

    const result = {
      success: true,
      processed: tasks.length,
      resolved,
      skipped_no_suggestions: skippedNoSuggestions,
      skipped_no_valid: skippedNoValid,
      details,
      elapsed_ms: Date.now() - start,
    };

    console.log(`Done: ${resolved} resolved, ${skippedNoSuggestions} no suggestions, ${skippedNoValid} no valid`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-resolve-bounces error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err), elapsed_ms: Date.now() - start }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
