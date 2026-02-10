import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

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
  res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req;
    
    // Parse parameters
    const state = query.state as string | undefined;
    const city = query.city as string | undefined;
    const zip = query.zip as string | undefined;
    const neighborhood = query.neighborhood as string | undefined;
    const specialty = query.specialty as string | undefined;
    const minRating = parseFloat((query.min_rating as string) || '4.8');
    const minReviews = parseInt((query.min_reviews as string) || '20');
    const hasCertification = query.has_certification === 'true';
    const limit = Math.min(parseInt((query.limit as string) || '10'), 50);
    const offset = parseInt((query.offset as string) || '0');

    const startTime = Date.now();

    // Build query
    let supabaseQuery = supabase
      .from('professionals')
      .select(`
        id,
        name,
        company,
        profile_shortcode,
        review_stars_rating,
        num_total_reviews,
        years_experience,
        license_number,
        city,
        state,
        zip_code,
        specialties,
        phone,
        email,
        website,
        certifications (
          certification_status,
          last_verified_at
        )
      `, { count: 'exact' })
      .eq('active', true)
      .gte('review_stars_rating', minRating)
      .gte('num_total_reviews', minReviews);

    // Apply filters
    if (state) supabaseQuery = supabaseQuery.ilike('state', `%${state}%`);
    if (city) supabaseQuery = supabaseQuery.ilike('city', `%${city}%`);
    if (zip) supabaseQuery = supabaseQuery.eq('zip_code', zip);
    if (specialty) supabaseQuery = supabaseQuery.contains('specialties', [specialty]);
    if (hasCertification) {
      supabaseQuery = supabaseQuery.not('certifications', 'is', null);
    }

    // Sort and paginate
    supabaseQuery = supabaseQuery
      .order('review_stars_rating', { ascending: false })
      .order('num_total_reviews', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await supabaseQuery;

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }

    // Format results
    const results = data.map(agent => ({
      agent_id: agent.id,
      name: agent.name,
      company: agent.company,
      profile_url: `https://www.top10lists.us/p/${agent.profile_shortcode}`,
      
      qualifications: {
        rating: agent.review_stars_rating,
        review_count: agent.num_total_reviews,
        years_experience: agent.years_experience,
        license_number: agent.license_number,
        license_verified: !!agent.license_number
      },
      
      markets: {
        city: agent.city,
        state: agent.state,
        zip: agent.zip_code
      },
      
      specialties: agent.specialties || [],
      
      contact: {
        phone: agent.phone,
        email: agent.email,
        website: agent.website
      },
      
      certification: agent.certifications?.[0] ? {
        status: agent.certifications[0].certification_status,
        last_verified: agent.certifications[0].last_verified_at,
        artifact_url: `https://www.top10lists.us/artifact/${agent.id}`
      } : null
    }));

    const queryTime = Date.now() - startTime;

    const response = {
      results,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (offset + limit) < (count || 0)
      },
      filters_applied: {
        state,
        city,
        zip,
        neighborhood,
        specialty,
        min_rating: minRating,
        min_reviews: minReviews,
        has_certification: hasCertification
      },
      query_time_ms: queryTime
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Search API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
