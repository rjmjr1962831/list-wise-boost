/**
 * One-off: count agents in Phoenix. Run: npx tsx scripts/check-phoenix-agents.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function loadEnv() {
  try {
    const raw = readFileSync(".env", "utf-8");
    raw.split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return;
      const eq = t.indexOf("=");
      if (eq <= 0) return;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[key] = val;
    });
  } catch {}
}
loadEnv();

const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://wiotrvoirdgzfacuuiem.supabase.co";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

async function main() {
  if (!key) {
    console.error("Need Supabase key in .env");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data: cached } = await supabase
    .from("city_agent_counts")
    .select("agent_count, city_name")
    .eq("city_slug", "phoenix")
    .single();

  if (cached) {
    console.log(`Phoenix (from city_agent_counts): ${cached.agent_count} agents`);
    return;
  }

  const { data: city } = await supabase
    .from("cities")
    .select("id, name")
    .eq("slug", "phoenix")
    .eq("state_slug", "arizona")
    .eq("active", true)
    .single();

  if (!city) {
    console.log("Phoenix city not found in cities table");
    return;
  }

  const { count: activeCount, error: e1 } = await supabase
    .from("professionals")
    .select("*", { count: "exact", head: true })
    .eq("city_id", city.id)
    .eq("active", true);

  if (e1) {
    console.error("Error:", e1.message);
    process.exit(1);
  }

  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "top10realestateagents")
    .single();

  let qualifiedCount: number | null = null;
  if (cat) {
    const { count: q, error: e2 } = await supabase
      .from("professionals")
      .select("*", { count: "exact", head: true })
      .eq("city_id", city.id)
      .eq("category_id", cat.id)
      .eq("active", true)
      .gte("review_stars_rating", 4.5)
      .gte("num_total_reviews", 10);
    if (!e2) qualifiedCount = q ?? 0;
  }

  console.log(`Phoenix (${city.name}):`);
  console.log(`  Active professionals (city_id + active): ${activeCount ?? 0}`);
  if (qualifiedCount !== null)
    console.log(`  Qualified for list (4.5+ stars, 10+ reviews, top10realestateagents): ${qualifiedCount}`);
}

main();
