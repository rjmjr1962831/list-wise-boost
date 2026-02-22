import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET")!;
const REDIRECT_URI = Deno.env.get("GMAIL_REDIRECT_URI")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const url = new URL(req.url);

  // Step 1: Initiate OAuth -- redirect to Google
  if (url.pathname.endsWith("gmail-oauth-callback") && !url.searchParams.get("code")) {
    const accountEmail = url.searchParams.get("account") || "";
    const scope = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ].join(" ");
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", accountEmail);
    authUrl.searchParams.set("login_hint", accountEmail);
    return Response.redirect(authUrl.toString(), 302);
  }

  // Step 2: Google redirects back with code
  const code = url.searchParams.get("code");
  const accountEmail = url.searchParams.get("state") || "";
  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (tokens.error) {
    return new Response(`Token error: ${tokens.error_description}`, { status: 400 });
  }

  // Get Gmail profile to confirm email
  const profileRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();
  const confirmedEmail = profile.emailAddress || accountEmail;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const expiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  const { error } = await supabase.from("crm_email_accounts").upsert({
    email: confirmedEmail,
    display_name: confirmedEmail,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: expiry,
    updated_at: new Date().toISOString(),
  }, { onConflict: "email" });

  if (error) {
    return new Response(`DB error: ${error.message}`, { status: 500 });
  }

  return new Response(
    `<html><body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
      <h2>Connected!</h2>
      <p><strong>${confirmedEmail}</strong> is now connected to the CRM.</p>
      <p>You can close this window and return to the CRM.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
});
