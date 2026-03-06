/**
 * Send the "Hi Lesley" email to rjmjr1@proton.me with a real Arizona professional's
 * dashboard link so Robert can test the links. Uses gmail-send.
 * Run: npx tsx scripts/send-lesley-test-to-proton.ts
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

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://wiotrvoirdgzfacuuiem.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, key);

// [text](url) is converted to clickable links by gmail-send; only the words show, not the URL.
const BODY_TEMPLATE = `Hi Lesley -

Loved talking to you just now.  I used to go to the Downtown Y when I lived downtown.

When you get 5 minutes, please go to [your profile]({{profile_url}}).  There you will confirm all the data we have compiled about you and select the cities and neighborhoods you want to be featured in.  This will immediately double the signal we have been putting out for you for the past three months.  Our certification tier is free for as long as you meet our selection criteria.

To see why we selected you, go to [my website](https://www.top10lists.us/) and look around.  Check out the methodology page, which gives you a detailed explanation.  Just to pre-qualify, you have to meet our gate of 4.5+ star rating across Google and Zillow, have 10+ certified reviews in the last 24 months (we certify them) and be in the business at least 5 years.  Because you meet those criteria, we then did a deep dive with AI and Human analysis to ensure that you really are the community leader we want to feature.

I ran the numbers for you.  Since Dec 1, the various AIs have evaluated your profile over 1000 times and you have been named as a top agent by the top 4 AIs  36 times.

You can ask any AI this question:

"I am a real estate agent.  Look at top10lists.us.  Will being certified there increase my chances of being named by you when asked for an agent referral?  What do the other major AIs think?"

Once you certify you can show your brother your profile, which will impress him.  Please check [your profile for accuracy]({{magic_link}}) so I can certify you.

 Thanks -

Robert Maynard
Founder
Top10list.us
(602) 758-9600`;

async function main() {
  const { data: pros } = await supabase
    .from("professionals")
    .select("id, name, verification_token")
    .ilike("name", "%lesley%vann%")
    .not("verification_token", "is", null)
    .limit(1);

  const pro = pros?.[0];
  if (!pro?.verification_token) {
    console.error("Lesley Vann not found or has no verification_token.");
    process.exit(1);
  }

  const magicLink = `https://www.top10lists.us/dashboard/${pro.verification_token}`;
  const body = BODY_TEMPLATE.replace(/\{\{profile_url\}\}/g, magicLink).replace(/\{\{magic_link\}\}/g, magicLink);

  console.log("Magic link (profile):", magicLink);
  console.log("Professional:", pro.name, "(id:", pro.id, ")");
  console.log("Sending to rjmjr1@proton.me...\n");

  const { data, error } = await supabase.functions.invoke("gmail-send", {
    body: {
      from_account: "robert@toptenlists.us",
      to: "rjmjr1@proton.me",
      subject: "Hi Lesley - Top10Lists",
      message_body: body,
    },
  });

  if (error) {
    console.error("Send failed:", error.message);
    process.exit(1);
  }
  if ((data as { error?: string })?.error) {
    console.error("Send failed:", (data as { error: string }).error);
    process.exit(1);
  }
  console.log("Sent successfully.", data);
}

main();
