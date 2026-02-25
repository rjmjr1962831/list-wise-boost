import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_SEND_URL = `${SUPABASE_URL}/functions/v1/gmail-send`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function substituteVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [key, val] of Object.entries(vars)) {
    // Support both {{camelCase}} and {{snake_case}} patterns
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
  }
  return out;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.json();
  const { template_id, template_name, professional_id, from_account, to_override } = body;

  if (!professional_id) {
    return new Response(JSON.stringify({ error: "professional_id is required" }), { status: 400 });
  }
  if (!template_id && !template_name) {
    return new Response(JSON.stringify({ error: "template_id or template_name is required" }), { status: 400 });
  }

  // Fetch template fresh from DB
  const tplQuery = supabase.from("crm_email_templates").select("id,name,subject,body");
  const { data: tplData, error: tplErr } = template_id
    ? await tplQuery.eq("id", template_id).single()
    : await tplQuery.eq("name", template_name).single();

  if (tplErr || !tplData) {
    return new Response(JSON.stringify({ error: "Template not found", detail: tplErr?.message }), { status: 404 });
  }

  // Fetch professional data fresh from DB
  const { data: pro, error: proErr } = await supabase
    .from("professionals")
    .select("id,name,email,magic_link,business_city,state_slug,current_tier,canonical_slug,verification_token")
    .eq("id", professional_id)
    .single();

  if (proErr || !pro) {
    return new Response(JSON.stringify({ error: "Professional not found", detail: proErr?.message }), { status: 404 });
  }

  const firstName = (pro.name || "").split(" ")[0] || "there";
  const lastName = (pro.name || "").split(" ").slice(1).join(" ") || "";
  const city = pro.business_city || "";
  const state = (pro.state_slug || "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  const magicLink = pro.magic_link || `https://www.top10lists.us/dashboard/${pro.verification_token}` || "https://www.top10lists.us";
  const profileUrl = pro.canonical_slug
    ? `https://www.top10lists.us/${pro.state_slug}/agents/${pro.canonical_slug}`
    : magicLink;

  const vars: Record<string, string> = {
    firstName, first_name: firstName,
    lastName, last_name: lastName,
    city, state,
    magicLink, magic_link: magicLink,
    profile_url: magicLink,   // profile_url = personalized entry point (dashboard or funnel)
    profileUrl: magicLink,
    public_profile_url: profileUrl,
    tier: pro.current_tier || "listed",
  };

  const subject = substituteVars(tplData.subject, vars);
  const message_body = substituteVars(tplData.body, vars);
  const to = to_override || pro.email;
  const sender = from_account || "robert@toptenlists.us";

  if (!to) {
    return new Response(JSON.stringify({ error: "No recipient email address" }), { status: 400 });
  }

  // Forward to gmail-send with fully substituted content
  const sendRes = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": req.headers.get("Authorization") || "",
    },
    body: JSON.stringify({ from_account: sender, to, subject, message_body }),
  });

  const result = await sendRes.json();

  return new Response(JSON.stringify({
    ...result,
    template_name: tplData.name,
    professional_name: pro.name,
    to,
    subject,
  }), { headers: { "Content-Type": "application/json" } });
});
