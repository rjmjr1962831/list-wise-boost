/**
 * Takeaways cron function - creates daily report slot for project memory.
 *
 * Invoked daily at 17:00 MST. Creates a row in daily_takeaways.
 * Robert will have Claude compile daily reports and incorporate into project-knowledge.mdc.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE = `# Daily Takeaways — {{DATE}}

## Outcomes to Commit to Project Memory

### Key Outcomes
- (Claude will fill from session when Robert runs takeaways)

### Config / Infrastructure Changes
- 

### Deprecated or New Patterns
- 

### Version Bump Notes
- 

---
*Claude compiles daily reports and incorporates into .cursor/rules/project-knowledge.mdc*`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Report date in MST (17:00 MST = 00:00 UTC next day, so use America/Denver)
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "America/Denver" });
    const content = TEMPLATE.replace("{{DATE}}", today);

    const { data, error } = await supabase
      .from("daily_takeaways")
      .upsert(
        {
          report_date: today,
          content,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "report_date",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        report_date: today,
        message: "Daily takeaways report created. Claude will compile into project-knowledge.mdc.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[takeaways] Error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
