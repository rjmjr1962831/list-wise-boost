/**
 * Canonical Agent Service
 * Manages stable, deterministic agent rankings for bot consumption
 */

import { supabase } from '@/integrations/supabase/client';
import { Professional } from '@/types/professional';
import { getValidImageUrl } from '@/utils/imageUrlValidator';

interface CanonicalRanking {
  id: string;
  city_id: string;
  category_id: string;
  professional_id: string;
  rank: number;
  score: number;
  last_calculated_at: string;
}

interface ScoringFactors {
  rating: number;
  reviewCount: number;
  totalSales: number;
  yearsExperience: number;
  hasRecentReview: boolean;
  pressMentions: number;
  badges: number;
}

/**
 * Calculates a deterministic score for an agent
 * Used to create stable rankings for bots
 */
function calculateAgentScore(professional: any): number {
  let score = 0;
  
  // Rating (0-50 points) - Most important factor
  const rating = professional.review_stars_rating || 0;
  score += (rating / 5) * 50;
  
  // Review count (0-20 points)
  const reviews = professional.num_total_reviews || 0;
  score += Math.min(reviews / 10, 20); // Max 20 points at 100+ reviews
  
  // Total sales (0-15 points)
  const sales = professional.total_sales || 0;
  score += Math.min(sales / 100, 15); // Max 15 points at 1500+ sales
  
  // Years experience (0-10 points)
  const years = professional.years_experience || 0;
  score += Math.min(years / 2, 10); // Max 10 points at 20+ years
  
  // Recent review activity (0-5 points)
  if (professional.has_recent_review) {
    score += 5;
  }
  
  // Press mentions (0-5 points)
  const pressMentions = professional.press_mentions?.length || 0;
  score += Math.min(pressMentions, 5);
  
  // Special badges (0-5 points)
  const badges = professional.badges?.length || 0;
  if (professional.is_brand_builder) score += 2;
  if (professional.is_premier_agent) score += 2;
  if (professional.is_top_agent) score += 1;
  
  return Math.round(score * 100) / 100; // Round to 2 decimals
}

/**
 * Fetches or generates canonical rankings for a city/category
 */
export async function getCanonicalRankings(
  cityId: string,
  categoryId: string
): Promise<Professional[]> {
  try {
    // First, try to fetch existing canonical rankings
    const { data: existingRankings, error: fetchError } = await supabase
      .from('canonical_city_rankings')
      .select(`
        *,
        professionals (*)
      `)
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .order('rank', { ascending: true });

    if (fetchError) {
      console.error('Error fetching canonical rankings:', fetchError);
    }

    // If we have recent rankings (less than 24 hours old), return them
    if (existingRankings && existingRankings.length > 0) {
      const latestUpdate = new Date(existingRankings[0].last_calculated_at);
      const hoursSinceUpdate = (Date.now() - latestUpdate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate < 24) {
        // Convert to Professional format
        return existingRankings
          .filter(r => r.professionals)
          .map((r: any) => convertToProfessional(r.professionals, r.rank));
      }
    }

    // Generate new canonical rankings
    console.log('Generating new canonical rankings for city:', cityId);
    return await generateCanonicalRankings(cityId, categoryId);
    
  } catch (error) {
    console.error('Error in getCanonicalRankings:', error);
    // Fallback to regular query if canonical rankings fail
    return await fetchFallbackRankings(cityId, categoryId);
  }
}

/**
 * Generates and stores new canonical rankings
 */
async function generateCanonicalRankings(
  cityId: string,
  categoryId: string
): Promise<Professional[]> {
  // Fetch all active professionals for this city/category
  const { data: professionals, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('city_id', cityId)
    .eq('category_id', categoryId)
    .eq('active', true)
    .gte('review_stars_rating', 4.5); // Only high-rated agents

  if (error || !professionals) {
    console.error('Error fetching professionals:', error);
    return [];
  }

  // Calculate scores for each professional
  const scoredProfessionals = professionals.map(prof => ({
    ...prof,
    calculatedScore: calculateAgentScore(prof)
  }));

  // Sort by score (descending) and then by name (ascending) for determinism
  scoredProfessionals.sort((a, b) => {
    if (b.calculatedScore !== a.calculatedScore) {
      return b.calculatedScore - a.calculatedScore;
    }
    return a.name.localeCompare(b.name);
  });

  // Take top 10
  const topProfessionals = scoredProfessionals.slice(0, 10);

  // Store canonical rankings in database
  try {
    // Delete existing rankings for this city/category
    await supabase
      .from('canonical_city_rankings')
      .delete()
      .eq('city_id', cityId)
      .eq('category_id', categoryId);

    // Insert new rankings
    const rankingsToInsert = topProfessionals.map((prof, index) => ({
      city_id: cityId,
      category_id: categoryId,
      professional_id: prof.id,
      rank: index + 1,
      score: prof.calculatedScore,
      last_calculated_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('canonical_city_rankings')
      .insert(rankingsToInsert);

    if (insertError) {
      console.error('Error storing canonical rankings:', insertError);
    }
  } catch (storeError) {
    console.error('Error in storing canonical rankings:', storeError);
  }

  // Return as Professional objects
  return topProfessionals.map((prof, index) => 
    convertToProfessional(prof, index + 1)
  );
}

/**
 * Fallback query if canonical rankings fail
 */
async function fetchFallbackRankings(
  cityId: string,
  categoryId: string
): Promise<Professional[]> {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('city_id', cityId)
    .eq('category_id', categoryId)
    .eq('active', true)
    .gte('review_stars_rating', 4.9)
    .order('review_stars_rating', { ascending: false })
    .order('num_total_reviews', { ascending: false })
    .limit(10);

  if (error || !data) {
    return [];
  }

  return data.map((prof, index) => convertToProfessional(prof, index + 1));
}

/**
 * Converts database professional to Professional type
 */
function convertToProfessional(dbProf: any, rank: number): Professional {
  // Validate image URL - reject placeholder/fake URLs
  const getValidImageUrl = (url: string | null): string => {
    if (!url) return '/placeholder.svg';
    
    // Reject known fake/placeholder patterns
    const invalidPatterns = [
      'example.com',
      '/path/to/',
      'johndoe',
      'john-doe',
      'placeholder',
      'youtube.com/channel',
      'youtube.com/watch',
    ];
    
    const lowerUrl = url.toLowerCase();
    if (invalidPatterns.some(pattern => lowerUrl.includes(pattern))) {
      return '/placeholder.svg';
    }
    
    // Must be a valid absolute URL (http/https) or start with /
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
      return '/placeholder.svg';
    }
    
    return url;
  };

  return {
    id: dbProf.id,
    rank,
    name: dbProf.name,
    company: dbProf.company || 'NA',
    title: dbProf.title || '',
    rating: dbProf.review_stars_rating || 0,
    reviews: dbProf.num_total_reviews || 0,
    specialties: dbProf.specialty || [],
    address: dbProf.address || 'NA',
    phone: dbProf.phone || 'NA',
    email: dbProf.email || 'NA',
    website: dbProf.website || 'NA',
    description: dbProf.description || '',
    stats: {
      yearsExperience: dbProf.years_experience || 0,
      totalSales: dbProf.total_sales || 0,
      currentListings: dbProf.current_listings || 0
    },
    verified: !!dbProf.license_verified_at,
    image: getValidImageUrl(dbProf.image_url),
    license_number: dbProf.license_number,
    license_verified_at: dbProf.license_verified_at,
    zuid: dbProf.zuid,
    zip_code: dbProf.zip_code,
    years_experience: dbProf.years_experience,
    zillow_data_fetched_at: dbProf.zillow_data_fetched_at,
    get_to_know_me: dbProf.get_to_know_me,
    notable_achievements: dbProf.notable_achievements || [],
    press_mentions: dbProf.press_mentions || [],
    synthesized_bio: dbProf.synthesized_bio,
    publications: dbProf.publications || []
  };
}

/**
 * Invalidates canonical rankings for a city/category
 * Called when agent data changes significantly
 */
export async function invalidateCanonicalRankings(
  cityId: string,
  categoryId: string,
  reason: string
): Promise<void> {
  try {
    await supabase
      .from('cache_invalidation_queue')
      .insert({
        city_id: cityId,
        category_id: categoryId,
        reason,
        status: 'pending'
      });
  } catch (error) {
    console.error('Error queueing cache invalidation:', error);
  }
}
