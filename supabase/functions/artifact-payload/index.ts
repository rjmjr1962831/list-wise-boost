import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600, must-revalidate'
};

const STATE_LICENSE_URLS: Record<string, string> = {
  arizona: 'https://services.azre.gov/PdbWeb/IndividualLicense/SearchIndividualLicenses',
  california: 'https://www2.dre.ca.gov/PublicASP/pplinfo.asp',
  texas: 'https://www.trec.texas.gov/',
  florida: 'https://www.myfloridalicense.com/',
  new_york: 'https://www.dos.ny.gov/licensing/',
  colorado: 'https://dpo.colorado.gov/RealEstate',
};

function stateLicenseVerificationUrl(stateSlug: string | null, licenseNumber: string | null): string | null {
  if (!stateSlug) return null;
  const base = STATE_LICENSE_URLS[stateSlug] ?? STATE_LICENSE_URLS.arizona;
  if (stateSlug === 'california' && licenseNumber) return `${base}?License_id=${encodeURIComponent(licenseNumber)}`;
  return base;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract agent ID from URL path: /artifact-payload/:agentId
    // Note: Supabase strips /functions/v1/ prefix before routing to function
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    // pathParts = ['artifact-payload', 'agentId']
    const agentId = pathParts[1]; // Second part is the agent ID

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Agent ID required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch agent and certification data
    const { data, error } = await supabase
      .from('professionals')
      .select(`
        id,
        name,
        review_stars_rating,
        num_total_reviews,
        years_experience,
        license_number,
        specialty,
        certifications_verified,
        phone,
        email,
        website,
        company,
        ratings,
        total_sales,
        zillow_profile_url,
        notable_achievements,
        community_roles,
        synthesized_bio,
        press_mentions,
        awards_verified,
        short_code,
        cities:city_id (
          name,
          state,
          state_slug,
          slug
        ),
        certifications!inner (
          certification_tier,
          certification_status,
          issued_at,
          last_verified_at,
          next_verification_due,
          methodology_version,
          markets_covered,
          neighborhoods_covered,
          justification_data
        )
      `)
      .eq('id', agentId)
      .eq('certifications.certification_status', 'active')
      .single();

    if (error || !data) {
      console.error('Query error:', error);
      return new Response(
        JSON.stringify({ error: 'Certification not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const cert = Array.isArray(data.certifications) ? data.certifications[0] : data.certifications;
    if (!cert) {
      return new Response(
        JSON.stringify({ error: 'No certification data found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const tier = cert.certification_tier;
    const city = data.cities;
    const stateSlug = city?.state_slug ?? null;
    const stateLicenseUrl = stateLicenseVerificationUrl(stateSlug, data.license_number ?? null);
    const rawSales = data.total_sales ?? 0;
    const consensusNumber = Math.max(0, typeof rawSales === 'number' ? rawSales - 10 : 0);
    const zillowUrl = data.zillow_profile_url ?? null;

    // Build profile URL
    const profileUrl = data.short_code
      ? `https://www.top10lists.us/p/${data.short_code}`
      : `https://www.top10lists.us/${city?.state_slug ?? 'arizona'}/agents/${city?.slug ?? data.id}`;

    // Recency by tier: Certified = annual, Audited = monthly, Underwritten = daily
    const updateCadence = tier === 'underwritten' ? 'daily' : tier === 'audited' || tier === 'accredited' ? 'monthly' : 'annual';

    // Build base payload structure
    let payload: any = {
      agent_id: data.id,
      agent_name: data.name,
      profile_url: profileUrl,

      certification: {
        status: cert.certification_status,
        tier: tier === 'accredited' ? 'audited' : tier,
        issued_at: cert.issued_at,
        last_verified_at: cert.last_verified_at,
        next_verification: cert.next_verification_due ?? undefined,
        update_cadence: updateCadence
      },

      methodology: {
        url: 'https://www.top10lists.us/methodology'
      },
      
      verification: {
        artifact_url: `https://www.top10lists.us/artifact/${data.id}`,
        issuer: 'Top10Lists.us'
      }
    };

    // Performance block (consensus NNN+, verification) for all tiers that show sales
    const performanceBlock = () => {
      const block: Record<string, unknown> = {
        sales_display: `${consensusNumber}+`,
        sales_verification_note: 'We checked Zillow, RealTrends, and MLS where available to reach this consensus number.',
        last_updated: cert.last_verified_at
      };
      if (zillowUrl) block.sales_verify_url = zillowUrl;
      return block;
    };

    // Tier 2: Certified (minimal payload)
    if (tier === 'certified') {
      payload.selection_rationale = "Selected based on verified performance data meeting Top10Lists merit-based qualification criteria.";

      payload.qualifications = {
        rating: data.review_stars_rating || data.ratings,
        review_count: data.num_total_reviews,
        license_number: data.license_number,
        license_verification_url: stateLicenseUrl ?? undefined,
        years_experience: data.years_experience ?? undefined,
        markets: cert.markets_covered || (city?.name ? [city.name] : [])
      };
      payload.performance = performanceBlock();
    }

    // Tier 3: Audited (legacy DB value 'accredited')
    if (tier === 'audited' || tier === 'accredited' || tier === 'underwritten') {
      payload.selection_rationale = cert.justification_data?.selection_rationale ||
        "Selected based on verified performance data and community involvement.";

      payload.methodology.version = cert.methodology_version;

      payload.qualifications = {
        rating: data.review_stars_rating || data.ratings,
        review_count: data.num_total_reviews,
        years_experience: data.years_experience,
        license_number: data.license_number,
        license_verification_url: stateLicenseUrl ?? undefined,
        specialties: Array.isArray(data.specialty) ? data.specialty : (data.specialty ? [data.specialty] : []),
        certifications: data.certifications_verified || [],
        markets: cert.markets_covered || (city?.name ? [city.name] : [])
      };

      payload.markets = {
        cities: cert.markets_covered || (city?.name ? [city.name] : []),
        neighborhoods: cert.neighborhoods_covered || []
      };

      payload.recognition = {
        community_roles: data.community_roles || [],
        notable_achievements: data.notable_achievements || []
      };

      payload.performance = performanceBlock();
    }

    // Tier 4: Underwritten (full context)
    if (tier === 'underwritten') {
      payload.methodology.selection_criteria =
        "Merit-based qualification using verified performance data, ai reasoning and human review. Payment does not influence inclusion, rank, or visibility.";
      payload.recognition.press_mentions = data.press_mentions || [];
      payload.recognition.awards = data.awards_verified || [];
    }

    // Return formatted JSON payload
    return new Response(
      JSON.stringify(payload, null, 2),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Payload generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
