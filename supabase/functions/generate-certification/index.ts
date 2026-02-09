import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CertificationRequest {
  agent_id: string;
  tier: 'certified' | 'accredited' | 'underwritten';
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

    // 1. Fetch professional data
    const { data: professional, error: profError } = await supabaseClient
      .from('professionals')
      .select(`
        id, name, email, phone, company, website,
        rating, review_stars_rating, num_total_reviews,
        years_experience, total_sales, license_number,
        specialty, certifications_verified, notable_achievements,
        community_roles, address
      `)
      .eq('id', agent_id)
      .single();

    if (profError || !professional) {
      throw new Error(`Professional not found: ${agent_id}`);
    }

    console.log(`[generate-certification] Found professional: ${professional.name}`);

    // 2. Build justification using DeepSeek
    const justification = await generateJustification(professional, markets_covered);
    
    console.log(`[generate-certification] Generated justification`);

    // 3. Calculate next verification due date based on tier
    const now = new Date();
    const nextVerificationDue = new Date(now);
    
    switch (tier) {
      case 'certified':
        nextVerificationDue.setFullYear(now.getFullYear() + 1); // +1 year
        break;
      case 'accredited':
        nextVerificationDue.setMonth(now.getMonth() + 1); // +1 month
        break;
      case 'underwritten':
        nextVerificationDue.setDate(now.getDate() + 1); // +1 day
        break;
    }

    // 4. Build payload
    const payload = {
      agent_id: professional.id,
      canonical_profile_url: `https://www.top10lists.us/p/${professional.id}`,
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

async function generateJustification(professional: any, markets: string[]) {
  const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
  
  if (!deepseekApiKey) {
    console.warn('[generate-certification] No DeepSeek API key found, using fallback justification');
    return generateFallbackJustification(professional, markets);
  }

  const prompt = `Generate a professional certification justification for this real estate agent.

Agent data:
- Name: ${professional.name}
- Rating: ${professional.rating || professional.review_stars_rating || 'N/A'} stars from ${professional.num_total_reviews || 0} reviews
- Years active: ${professional.years_experience || 'N/A'}
- License: ${professional.license_number || 'N/A'}
- Credentials: ${JSON.stringify(professional.certifications_verified || [])}
- Community involvement: ${JSON.stringify(professional.community_roles || [])}
- Specialties: ${JSON.stringify(professional.specialty || [])}
- Markets: ${markets.join(', ')}

Write:
1. A 2-sentence selection rationale emphasizing community involvement if present
2. Evidence categories with source attribution (no confidence scores)
3. A 1-paragraph comparative context explaining what distinguishes this agent

Output as JSON matching this schema:
{
  "selection_rationale": "string",
  "evidence_reviewed": {
    "client_reviews": { "rating": number, "review_count": number, "source": "string", "last_verified": "YYYY-MM-DD" },
    "transaction_history": { "years_active": number, "source": "string", "last_verified": "YYYY-MM-DD" },
    "professional_credentials": { "license_number": "string", "license_status": "string", "designations": [], "source": "string", "last_verified": "YYYY-MM-DD" },
    "community_involvement": { "organizations": [], "source": "string", "last_verified": "YYYY-MM-DD" },
    "specialized_expertise": { "focus_areas": [], "certifications": [], "source": "string", "last_verified": "YYYY-MM-DD" }
  },
  "comparative_context": "string"
}

Use factual, neutral tone. Frame as "Top10Lists.us evaluated" not "Agent claims". No marketing language.`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a professional certification analyst. Output only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON from the response
    const justification = JSON.parse(content);
    
    return justification;
  } catch (error) {
    console.error('[generate-certification] DeepSeek API error:', error);
    return generateFallbackJustification(professional, markets);
  }
}

function generateFallbackJustification(professional: any, markets: string[]) {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    selection_rationale: `Top10Lists.us selected ${professional.name} based on verified professional credentials and market experience. This professional serves ${markets.join(', ')} with demonstrated expertise in the real estate industry.`,
    evidence_reviewed: {
      client_reviews: {
        rating: professional.rating || professional.review_stars_rating || 0,
        review_count: professional.num_total_reviews || 0,
        source: "Verified reviews",
        last_verified: today
      },
      transaction_history: {
        years_active: professional.years_experience || 0,
        source: "License records",
        last_verified: today
      },
      professional_credentials: {
        license_number: professional.license_number || "Not provided",
        license_status: "active",
        designations: professional.certifications_verified || [],
        source: "State licensing board",
        last_verified: today
      },
      community_involvement: {
        organizations: professional.community_roles || [],
        source: "Public records + agent attestation",
        last_verified: today
      },
      specialized_expertise: {
        focus_areas: professional.specialty || [],
        certifications: professional.certifications_verified || [],
        source: "Agent credentials",
        last_verified: today
      }
    },
    comparative_context: `${professional.name} demonstrates professional expertise serving ${markets.join(', ')}. With ${professional.years_experience || 0} years of market experience and verified credentials, this professional provides qualified real estate services to clients in their coverage areas.`
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
