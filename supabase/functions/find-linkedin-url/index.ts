import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-enrichment-key",
};

/**
 * find-linkedin-url
 *
 * Given agent name + city (+ optional state), uses Google Custom Search
 * to find their LinkedIn profile URL. Optionally saves to professionals table.
 *
 * Input (JSON body):
 *   { name, city, state?, professional_id?, save? }
 *
 * Batch mode:
 *   { agents: [{ name, city, state?, professional_id? }], save? }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_CSE_API_KEY");
    const cx = Deno.env.get("GOOGLE_CSE_CX");
    if (!apiKey || !cx) {
      return new Response(
        JSON.stringify({ success: false, error: "GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // Batch mode
    if (Array.isArray(body.agents)) {
      const results = [];
      for (const agent of body.agents.slice(0, 50)) {
        const result = await findLinkedIn(apiKey, cx, agent.name, agent.city, agent.state);
        results.push({ ...agent, ...result });
        // Google CSE rate limit: 100 queries/day free, then $5/1000
        if (body.agents.length > 5) await new Promise((r) => setTimeout(r, 250));
      }

      if (body.save) {
        await saveResults(results.filter((r) => r.linkedin_url && r.professional_id));
      }

      return new Response(
        JSON.stringify({ success: true, count: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single mode
    const { name, city, state, professional_id } = body;
    if (!name || !city) {
      return new Response(
        JSON.stringify({ success: false, error: "name and city are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await findLinkedIn(apiKey, cx, name, city, state);

    if (body.save && result.linkedin_url && professional_id) {
      await saveResults([{ professional_id, linkedin_url: result.linkedin_url }]);
    }

    return new Response(
      JSON.stringify({ success: true, name, city, state, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("find-linkedin-url error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function findLinkedIn(
  apiKey: string,
  cx: string,
  name: string,
  city: string,
  state?: string
): Promise<{ linkedin_url: string | null; title: string | null; snippet: string | null }> {
  const location = state ? `${city} ${state}` : city;
  const query = `"${name}" "${location}" real estate site:linkedin.com/in`;

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "3");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error(`Google CSE error for "${name}":`, await res.text());
    return { linkedin_url: null, title: null, snippet: null };
  }

  const data = await res.json();
  const items = data.items || [];

  // Find first linkedin.com/in/ result
  const match = items.find(
    (item: any) => item.link && /linkedin\.com\/in\//i.test(item.link)
  );

  if (!match) {
    return { linkedin_url: null, title: null, snippet: null };
  }

  // Clean the URL (remove query params, trailing slashes)
  const cleanUrl = match.link.split("?")[0].replace(/\/+$/, "");

  return {
    linkedin_url: cleanUrl,
    title: match.title || null,
    snippet: match.snippet?.substring(0, 200) || null,
  };
}

async function saveResults(
  results: Array<{ professional_id: string; linkedin_url: string }>
) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  for (const r of results) {
    await supabase
      .from("professionals")
      .update({ social_linkedin: r.linkedin_url })
      .eq("id", r.professional_id);
  }
}
