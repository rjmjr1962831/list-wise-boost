import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=600, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract agent ID from URL path
    const { query } = req;
    const agentId = query.id as string;

    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID required' });
    }

    const { data, error } = await supabase
      .from('professionals')
      .select(`
        *,
        certifications (*)
      `)
      .eq('id', agentId)
      .eq('active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const cert = data.certifications?.[0];

    const response = {
      agent_id: data.id,
      name: data.name,
      title: data.title,
      company: data.company,
      bio: data.synthesized_bio,
      image_url: data.image_url,
      profile_url: `https://www.top10lists.us/p/${data.profile_shortcode}`,
      
      contact: {
        phone: data.phone,
        email: data.email,
        website: data.website,
        zillow_profile: data.zillow_profile_url
      },
      
      qualifications: {
        rating: data.review_stars_rating,
        review_count: data.num_total_reviews,
        years_experience: data.years_experience,
        license_number: data.license_number,
        license_type: data.license_type,
        license_verified: !!data.license_number,
        certifications: data.certifications || [],
        languages: data.languages || [],
        specialties: data.specialties || []
      },
      
      markets: {
        city: data.city,
        state: data.state,
        state_slug: data.state_slug,
        city_slug: data.canonical_slug,
        zip: data.zip_code,
        neighborhoods: data.served_cities || [],
        service_areas: data.service_areas || []
      },
      
      performance: {
        zillow_member_since: data.zillow_member_since,
        sales_count_all_time: data.sales_count_all_time,
        sales_count_last_year: data.sales_count_last_year,
        price_range_min: data.price_range_3yr_min,
        price_range_max: data.price_range_3yr_max,
        average_price_3yr: data.average_value_3yr,
        active_listings: data.active_for_sale_count,
        stats_last_updated: data.zillow_last_scraped_at
      },
      
      recognition: {
        press_mentions: data.press_mentions || [],
        notable_achievements: data.notable_achievements || [],
        community_roles: data.community_roles || []
      },
      
      certification: cert ? {
        status: cert.certification_status,
        issued_at: cert.issued_at,
        last_verified_at: cert.last_verified_at,
        next_verification: cert.next_verification_due,
        artifact_url: `https://www.top10lists.us/artifact/${data.id}`,
        selection_rationale: cert.justification_data?.selection_rationale
      } : null,
      
      methodology: {
        url: 'https://www.top10lists.us/methodology',
        version: cert?.methodology_version || '1.0'
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Agent details API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
