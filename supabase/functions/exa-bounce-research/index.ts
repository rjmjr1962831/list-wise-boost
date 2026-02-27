/**
 * Bounce research: returns suggested emails from the agent's data blobs.
 * Exa API DEPRECATED – extracts emails from raw_scraper_data, professional_information, professional_data.
 * POST body: { professional_id: string }
 * Returns: { results: [], suggestedEmails: string[], query: string }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const OUR_DOMAINS = ["top10lists.us", "toptenlists.us", "googlemail.com", "google.com", "gmail.com"];

function extractEmailsFromText(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  return (text.match(EMAIL_REGEX) || []).map((e) => e.toLowerCase().trim()).filter(Boolean);
}

function extractEmailsFromBlobs(pro: any, bouncedEmail: string): string[] {
  const seen = new Set<string>([bouncedEmail.toLowerCase().trim()]);
  const suggested: string[] = [];

  const add = (email: string) => {
    if (!email || typeof email !== "string" || !email.includes("@")) return;
    const lower = email.toLowerCase().trim();
    if (seen.has(lower)) return;
    const domain = lower.split("@")[1] || "";
    if (OUR_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return;
    seen.add(lower);
    suggested.push(email);
  };

  const raw = pro.raw_scraper_data as any;
  if (raw) {
    if (Array.isArray(raw.emails)) raw.emails.forEach((e: string) => add(e));
    else if (raw.email) add(raw.email);
    if (raw.getToKnowMe?.email) add(raw.getToKnowMe.email);
    if (raw.professionalInformation && Array.isArray(raw.professionalInformation)) {
      const emailEntry = raw.professionalInformation.find(
        (info: any) => info.term === "Email" || info.term === "Contact Email" || info.term === "email"
      );
      if (emailEntry?.detail) {
        const v = Array.isArray(emailEntry.detail) ? emailEntry.detail[0] : emailEntry.detail;
        if (typeof v === "string") add(v);
        else if (v?.text) add(v.text);
        else if (v?.link) add(v.link.replace("mailto:", "").trim());
      }
    }
    const rawStr = JSON.stringify(raw);
    extractEmailsFromText(rawStr).forEach(add);
  }

  const profInfo = pro.professional_information as any;
  if (profInfo) {
    if (Array.isArray(profInfo)) {
      const emailEntry = profInfo.find(
        (info: any) => info.term === "Email" || info.term === "Contact Email" || info.term === "email"
      );
      if (emailEntry?.detail) {
        const v = Array.isArray(emailEntry.detail) ? emailEntry.detail[0] : emailEntry.detail;
        if (typeof v === "string") add(v);
        else if (v?.text) add(v.text);
        else if (v?.link) add(v.link.replace("mailto:", "").trim());
      }
    }
    extractEmailsFromText(JSON.stringify(profInfo)).forEach(add);
  }

  const profData = pro.professional_data as any;
  if (profData) extractEmailsFromText(JSON.stringify(profData)).forEach(add);

  return [...new Set(suggested)].slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const professionalId = body?.professional_id;
    if (!professionalId) {
      return new Response(
        JSON.stringify({ error: "professional_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: pro, error: proError } = await supabase
      .from("professionals")
      .select("id, name, email, company, business_name, business_city, state_slug, raw_scraper_data, professional_information, professional_data")
      .eq("id", professionalId)
      .single();

    if (proError || !pro) {
      return new Response(
        JSON.stringify({ error: "Professional not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bouncedEmail = (pro.email || "").toLowerCase().trim();
    const company = (pro.company || pro.business_name || "").trim();
    const city = (pro.business_city || "").trim();
    const state = (pro.state_slug || "").replace(/-/g, " ");
    const query = [pro.name, "real estate agent", city, state, company].filter(Boolean).join(" ");
    const fullQuery = query ? query + " contact email" : "";

    const suggestedEmails = extractEmailsFromBlobs(pro, bouncedEmail);

    return new Response(
      JSON.stringify({
        results: [],
        suggestedEmails,
        query: fullQuery,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("exa-bounce-research error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
