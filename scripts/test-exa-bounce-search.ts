/**
 * Test Exa search used for bounce email lookup (same logic as gmail-sync handleBounce).
 * Run: npx tsx scripts/test-exa-bounce-search.ts
 * Requires EXA_API_KEY in .env or .env.local (or .secrets/.env).
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

function loadEnv(dir: string, file: string): void {
  const envPath = resolve(dir, file);
  if (!existsSync(envPath)) return;
  try {
    const env = readFileSync(envPath, "utf-8");
    for (const line of env.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (_) {}
}

const cwd = process.cwd();
loadEnv(cwd, ".env");
loadEnv(cwd, ".env.local");
loadEnv(cwd, ".env.production");
if (existsSync(resolve(cwd, ".secrets"))) {
  loadEnv(resolve(cwd, ".secrets"), ".env");
  try {
    for (const f of readdirSync(resolve(cwd, ".secrets"))) {
      if (f.endsWith(".env") || f === "env") loadEnv(resolve(cwd, ".secrets"), f);
    }
  } catch (_) {}
}

const EXA_API_KEY = process.env.EXA_API_KEY;
if (!EXA_API_KEY) {
  console.error("Missing EXA_API_KEY. Set in .env, .env.local, or .secrets/.env");
  process.exit(1);
}

// Sample "bounced" agent (real estate agent so Exa returns relevant pages)
const pro = {
  name: "Cheryl Halvorson",
  company: "Realty One Group",
  business_city: "Scottsdale",
  state_slug: "arizona",
};
const bouncedEmail = "old@example.com";

async function main() {
  const company = (pro.company || "").trim();
  const city = (pro.business_city || "").trim();
  const state = (pro.state_slug || "").replace(/-/g, " ");
  const query = [pro.name, "real estate agent", city, state, company].filter(Boolean).join(" ");
  const fullQuery = query + " contact email";

  console.log("Exa query:", fullQuery);
  console.log("");

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": EXA_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: fullQuery,
      useAutoprompt: true,
      numResults: 8,
      type: "auto",
      contents: { text: { maxCharacters: 2000 }, highlights: true },
    }),
  });

  console.log("Exa status:", res.status, res.statusText);
  if (!res.ok) {
    const text = await res.text();
    console.error("Body:", text.slice(0, 500));
    process.exit(1);
  }

  const data = await res.json();
  const results = data.results || [];
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const ourDomains = ["top10lists.us", "toptenlists.us", "googlemail.com", "google.com", "gmail.com"];
  const seen = new Set<string>([bouncedEmail.toLowerCase()]);
  const suggested: string[] = [];

  for (const r of results) {
    const text = [r.text || "", (r.highlights || []).join(" ")].join(" ");
    const matches = text.match(emailRegex) || [];
    for (const email of matches) {
      const lower = email.toLowerCase().trim();
      if (seen.has(lower)) continue;
      const domain = lower.split("@")[1] || "";
      if (ourDomains.some((d) => domain === d || domain.endsWith("." + d))) continue;
      seen.add(lower);
      suggested.push(email);
    }
  }

  console.log("Results count:", results.length);
  console.log("Suggested emails (deduped, excluding our domains):", [...new Set(suggested)].slice(0, 10));
  if (results.length > 0) {
    console.log("\nFirst result URL:", results[0].url);
    console.log("First result text (first 300 chars):", (results[0].text || "").slice(0, 300));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
