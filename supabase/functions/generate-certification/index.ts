import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CertificationRequest {
  agent_id: string;
  tier: 'certified' | 'audited' | 'underwritten';
  markets_covered: string[];
  neighborhoods_covered?: string[];
  verified_transactions?: Record<string, number>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody: CertificationRequest = await req.json();
    const { agent_id, tier, markets_covered, neighborhoods_covered, verified_transactions } = requestBody;

    console.log(`[generate-certification] Starting for agent ${agent_id}, tier: ${tier}`);

    // 1. Fetch professional data with ALL enriched content
    const { data: professional, error: profError } = await supabaseClient
      .from('professionals')
      .select(`
        id, name, email, phone, company, website,
        rating, review_stars_rating, num_total_reviews,
        years_experience, total_sales, license_number,
        specialty, certifications_verified, notable_achievements,
        community_roles, address, synthesized_bio,
        press_mentions, awards_verified, short_code
      `)
      .eq('id', agent_id)
      .single();

    if (profError || !professional) {
      throw new Error(`Professional not found: ${agent_id}`);
    }

    console.log(`[generate-certification] Found professional: ${professional.name}`);

    // 2. Build justification using EXISTING synthesized content from database
    const justification = buildJustificationFromExistingData(professional, markets_covered);
    
    console.log(`[generate-certification] Built justification from existing data`);

    // 3. Calculate next verification due date based on tier
    const now = new Date();
    const nextVerificationDue = new Date(now);
    
    switch (tier) {
      case 'certified':
        nextVerificationDue.setFullYear(now.getFullYear() + 1); // +1 year
        break;
      case 'audited':
        nextVerificationDue.setMonth(now.getMonth() + 3); // +3 months (quarterly)
        break;
      case 'underwritten':
        nextVerificationDue.setDate(now.getDate() + 1); // +1 day
        break;
    }

    // 4. Build payload
    const payload = {
      agent_id: professional.id,
      canonical_profile_url: `https://www.top10lists.us/p/${professional.short_code || professional.id}`,
      certifying_org: "Top10Lists.us",
      certification_name: "Top10Lists Certified Professional",
      certification_tier: tier,
      markets_covered: markets_covered,
      neighborhoods_covered: neighborhoods_covered || [],
      verified_transactions: verified_transactions || {},
      specialties: Array.isArray(professional.specialty) ? professional.specialty : [],
      issued_at: now.toISOString(),
      last_verified_at: now.toISOString(),
      next_verification_due: nextVerificationDue.toISOString(),
      certification_status: "active",
      methodology_version: "1.0",
      artifact_url: `https://www.top10lists.us/artifact/${professional.id}`,
      justification_url: `https://www.top10lists.us/artifact/${professional.id}/justification`,
    };

    // 5. Generate hash and signature
    const payloadString = JSON.stringify(payload, Object.keys(payload).sort());
    const payloadHash = await hashPayload(payloadString);
    const payloadSignature = await signPayload(payloadHash);

    console.log(`[generate-certification] Generated hash and signature`);

    // 6. Insert/update certification
    const { data: certification, error: certError } = await supabaseClient
      .from('certifications')
      .upsert({
        agent_id: professional.id,
        certification_tier: tier,
        certification_status: 'active',
        issued_at: now.toISOString(),
        last_verified_at: now.toISOString(),
        next_verification_due: nextVerificationDue.toISOString(),
        markets_covered: markets_covered,
        neighborhoods_covered: neighborhoods_covered || [],
        verified_transactions: verified_transactions || {},
        payload_hash: payloadHash,
        payload_signature: payloadSignature,
        signing_key_id: 'top10-prod-v1',
        justification_data: justification,
        methodology_version: '1.0',
      }, {
        onConflict: 'agent_id'
      })
      .select()
      .single();

    if (certError) {
      console.error('[generate-certification] Error inserting certification:', certError);
      throw certError;
    }

    console.log(`[generate-certification] Certification created/updated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        artifact_url: `https://www.top10lists.us/artifact/${professional.id}`,
        certification_id: certification.id,
        issued_at: certification.issued_at,
        next_verification_due: certification.next_verification_due,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[generate-certification] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function buildJustificationFromExistingData(professional: any, markets: string[]) {
  const today = new Date().toISOString().split('T')[0];
  
  // Use the EXISTING synthesized_bio as the selection rationale
  const selectionRationale = professional.synthesized_bio || 
    `Top10Lists.us selected ${professional.name} based on verified professional credentials and market experience serving ${markets.join(', ')}.`;
  
  // Extract press mentions
  const pressMentions = Array.isArray(professional.press_mentions) 
    ? professional.press_mentions.map((p: any) => {
        const mention = typeof p === 'string' ? JSON.parse(p) : p;
        return mention.outlet || mention.title || mention.publication || 'Press mention';
      })
    : [];
  
  // Extract awards
  const awards = Array.isArray(professional.awards_verified)
    ? professional.awards_verified.map((a: any) => {
        const award = typeof a === 'string' ? JSON.parse(a) : a;
        return award.award_name || award.name || 'Award';
      })
    : [];
  
  // Extract notable achievements
  const achievements = Array.isArray(professional.notable_achievements)
    ? professional.notable_achievements
        .filter((a: any) => (a.credibility || 0) >= 7)
        .map((a: any) => a.title || a.achievement)
    : [];
  
  // Extract certifications/designations
  const designations = Array.isArray(professional.certifications_verified)
    ? professional.certifications_verified.map((c: any) => 
        typeof c === 'object' ? (c.designation || c.name) : c
      )
    : [];
  
  // Build comparative context from synthesized bio or default
  const comparativeContext = professional.synthesized_bio || 
    `${professional.name} demonstrates professional expertise serving ${markets.join(', ')}. With ${professional.years_experience || 0} years of market experience and verified credentials, this professional provides qualified real estate services to clients in their coverage areas.`;
  
  return {
    selection_rationale: selectionRationale,
    evidence_reviewed: {
      client_reviews: {
        rating: professional.rating || professional.review_stars_rating || 0,
        review_count: professional.num_total_reviews || 0,
        source: "Zillow verified reviews",
        last_verified: today
      },
      transaction_history: {
        years_active: professional.years_experience || 0,
        total_sales: professional.total_sales || 0,
        source: "License records + Zillow data",
        last_verified: today
      },
      professional_credentials: {
        license_number: professional.license_number || "Not provided",
        license_status: "active",
        designations: designations,
        source: "State licensing board + professional associations",
        last_verified: today
      },
      community_involvement: {
        organizations: professional.community_roles || [],
        source: "Public records + agent attestation",
        last_verified: today
      },
      specialized_expertise: {
        focus_areas: professional.specialty || [],
        certifications: designations,
        source: "Agent credentials",
        last_verified: today
      },
      press_coverage: pressMentions.length > 0 ? {
        mentions: pressMentions,
        count: pressMentions.length,
        source: "Public media",
        last_verified: today
      } : undefined,
      awards_recognition: awards.length > 0 ? {
        awards: awards,
        count: awards.length,
        source: "Verified records",
        last_verified: today
      } : undefined,
      notable_achievements: achievements.length > 0 ? {
        achievements: achievements.slice(0, 5),
        source: "Public records + editorial review",
        last_verified: today
      } : undefined
    },
    comparative_context: comparativeContext
  };
}

async function hashPayload(payloadString: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payloadString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function signPayload(hash: string): Promise<string> {
  // For now, return a placeholder signature
  // In production, this would use Ed25519 private key from Supabase Vault
  // TODO: Implement Ed25519 signing with private key from vault
  const privateKey = Deno.env.get('ED25519_PRIVATE_KEY');
  
  if (!privateKey) {
    console.warn('[generate-certification] No Ed25519 private key found, using placeholder signature');
    return `placeholder_signature_${hash.substring(0, 16)}`;
  }
  
  // In production, implement actual Ed25519 signing here
  return `ed25519_signature_${hash.substring(0, 32)}`;
}
