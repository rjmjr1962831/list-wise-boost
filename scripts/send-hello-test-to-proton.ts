/**
 * Send template from hello@toptenlists.us to rjmjr1@proton.me
 * Run: npx tsx scripts/send-hello-test-to-proton.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnv();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://wiotrvoirdgzfacuuiem.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: pro, error: proErr } = await supabase
    .from("professionals")
    .select("id,name,email")
    .ilike("email", "robert@maynard.com")
    .limit(1)
    .maybeSingle();

  if (proErr || !pro) {
    console.error("Professional robert@maynard.com not found:", proErr?.message ?? "No match");
    process.exit(1);
  }

  console.log("Sending from hello@toptenlists.us to rjmjr1@proton.me...");

  const { data, error } = await supabase.functions.invoke("send-template", {
    body: {
      template_name: "I am the Cofounder of LifeLock",
      professional_id: pro.id,
      to_override: "rjmjr1@proton.me",
      from_account: "hello@toptenlists.us",
    },
  });

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  if ((data as { error?: string })?.error) {
    console.error("Send failed:", (data as { error: string }).error);
    process.exit(1);
  }
  console.log("Sent:", data);
}

main();
