import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { state = "Arizona", limit = 50, offset = 0, dryRun = false } = await req.json().catch(() => ({}));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔍 Finding unenriched qualified agents in ${state} (limit: ${limit}, offset: ${offset})`);

    // Find qualified but unenriched agents
    const { data: agents, error: fetchError } = await supabase
      .from("professionals")
      .select(`
        id, name, email, phone, website, zillow_profile_url,
        review_stars_rating, num_total_reviews,
        cities!inner(name, state)
      `)
      .eq("cities.state", state)
      .eq("active", true)
      .gte("review_stars_rating", 4.8)
      .gte("num_total_reviews", 20)
      .is("synthesized_bio", null)
      .not("zillow_profile_url", "is", null)
      .order("num_total_reviews", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    console.log(`📋 Found ${agents?.length || 0} agents to enrich`);

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No unenriched agents found",
          stats: { total: 0, enriched: 0, failed: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Dry run: would enrich ${agents.length} agents`,
          agents: agents.map(a => ({ id: a.id, name: a.name, reviews: a.num_total_reviews })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stats = { total: agents.length, enriched: 0, failed: 0, errors: [] as string[] };

    for (const agent of agents) {
      try {
        console.log(`🔄 Enriching ${agent.name} (${agent.num_total_reviews} reviews)...`);

        if (!agent.zillow_profile_url) {
          console.log(`⚠️ No Zillow URL for ${agent.name}, skipping`);
          stats.failed++;
          stats.errors.push(`${agent.name}: No Zillow URL`);
          continue;
        }

        // Call Firecrawl to scrape Zillow profile
        const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${firecrawlApiKey}`,
          },
          body: JSON.stringify({
            url: agent.zillow_profile_url,
            formats: ["extract"],
            extract: {
              schema: {
                type: "object",
                properties: {
                  agentName: { type: "string" },
                  bio: { type: "string" },
                  specialties: { type: "array", items: { type: "string" } },
                  yearsExperience: { type: "number" },
                  totalSales: { type: "number" },
                  currentListings: { type: "number" },
                  averagePrice: { type: "number" },
                  languages: { type: "array", items: { type: "string" } },
                  serviceAreas: { type: "array", items: { type: "string" } },
                  certifications: { type: "array", items: { type: "string" } },
                  brokerageName: { type: "string" },
                  phone: { type: "string" },
                  email: { type: "string" },
                  website: { type: "string" },
                },
                required: ["agentName"],
              },
            },
          }),
        });

        if (!firecrawlResponse.ok) {
          const errText = await firecrawlResponse.text();
          console.error(`❌ Firecrawl error for ${agent.name}: ${errText}`);
          stats.failed++;
          stats.errors.push(`${agent.name}: Firecrawl error`);
          continue;
        }

        const firecrawlData = await firecrawlResponse.json();
        const extracted = firecrawlData.data?.extract;

        if (!extracted) {
          console.error(`❌ No extract data for ${agent.name}`);
          stats.failed++;
          stats.errors.push(`${agent.name}: No extract data`);
          continue;
        }

        // Update the professional with enriched data
        const updateData: Record<string, any> = {
          profile_last_synthesized_at: new Date().toISOString(),
        };

        if (extracted.bio) {
          updateData.synthesized_bio = extracted.bio;
        }
        if (extracted.yearsExperience) {
          updateData.years_experience = extracted.yearsExperience;
        }
        if (extracted.totalSales) {
          updateData.total_sales = extracted.totalSales;
        }
        if (extracted.currentListings) {
          updateData.current_listings = extracted.currentListings;
        }
        if (extracted.specialties && Array.isArray(extracted.specialties)) {
          updateData.specialty = extracted.specialties;
        }
        if (extracted.languages && Array.isArray(extracted.languages)) {
          updateData.languages = extracted.languages;
        }
        if (extracted.serviceAreas && Array.isArray(extracted.serviceAreas)) {
          updateData.service_areas = extracted.serviceAreas;
        }
        if (extracted.certifications && Array.isArray(extracted.certifications)) {
          updateData.certifications = extracted.certifications;
        }
        if (extracted.brokerageName) {
          updateData.company = extracted.brokerageName;
        }
        if (extracted.website && !agent.website) {
          updateData.website = extracted.website;
        }

        const { error: updateError } = await supabase
          .from("professionals")
          .update(updateData)
          .eq("id", agent.id);

        if (updateError) {
          console.error(`❌ Update error for ${agent.name}: ${updateError.message}`);
          stats.failed++;
          stats.errors.push(`${agent.name}: Update error`);
          continue;
        }

        console.log(`✅ Enriched ${agent.name}`);
        stats.enriched++;

        // Rate limit: 500ms between Firecrawl calls
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (agentError: any) {
        console.error(`❌ Error processing ${agent.name}: ${agentError.message}`);
        stats.failed++;
        stats.errors.push(`${agent.name}: ${agentError.message}`);
      }
    }

    // Check if there are more agents to process
    const { count } = await supabase
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .gte("review_stars_rating", 4.8)
      .gte("num_total_reviews", 20)
      .is("synthesized_bio", null)
      .not("zillow_profile_url", "is", null);

    const hasMore = (count || 0) > 0;
    const nextOffset = offset + limit;

    // Auto-continue if there are more
    if (hasMore && stats.enriched > 0) {
      console.log(`🔄 Triggering next batch at offset ${nextOffset}...`);
      
      // Fire and forget the next batch
      fetch(`${supabaseUrl}/functions/v1/enrich-unenriched-agents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ state, limit, offset: nextOffset, dryRun: false }),
      }).catch(err => console.error("Failed to trigger next batch:", err));
    }

    console.log(`\n✅ Batch complete: ${stats.enriched} enriched, ${stats.failed} failed`);
    console.log(`📍 Remaining: ${count || 0}, hasMore: ${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Enriched ${stats.enriched} agents, ${stats.failed} failed`,
        stats,
        hasMore,
        nextOffset: hasMore ? nextOffset : null,
        remaining: count || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
