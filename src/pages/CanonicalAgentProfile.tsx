import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import AgentProfileDossier, { Memo23Agent, StateLicense, Review } from '@/components/AgentProfileDossier';
import { Professional } from '@/types/professional';
import { generateAgentProfileSchema, professionalToSchemaData } from '@/utils/agentSchema';
import { generateVerifiedAgentSchema, generateCitationText } from '@/utils/verifiedAgentSchema';
import { professionalToVerifiedAgent } from '@/utils/professionalToVerifiedAgent';
import { VerifiedAgent } from '@/types/verifiedAgent';
import { getValidImageUrl } from '@/utils/imageUrlValidator';

interface DBProfessional {
  id: string;
  name: string;
  title: string | null;
  category_id: string;
  city_id: string;
  rank: number;
  type: string;
  specialty: string[] | null;
  years_experience: number | null;
  badges: string[] | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  image_url: string | null;
  zuid: string | null;
  company: string | null;
  current_listings: number | null;
  total_sales: number | null;
  license_number: string | null;
  license_verified_at: string | null;
  license_type: string | null;
  license_status: string | null;
  license_issued_at: string | null;
  license_expires_at: string | null;
  zillow_profile_url: string | null;
  zillow_data_fetched_at: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  sidebar_video_url: string | null;
  ratings: any | null;
  professional_information: any | null;
  get_to_know_me: string | null;
  agent_sales_stats: any | null;
  notable_achievements: any | null;
  press_mentions: any | null;
  synthesized_bio: string | null;
  publications: any | null;
  social_linkedin: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  certifications: any | null;
  certifications_verified: any | null;
  awards_verified: any | null;
  platform_reviews: any | null;
  data_sources_log: any | null;
  card_created_at: string | null;
  created_at: string;
  updated_at: string;
  // New canonical fields
  canonical_slug: string | null;
  state_slug: string | null;
  served_cities: string[] | null;
}

interface City {
  id: string;
  name: string;
  state: string;
  state_slug: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  plural_name: string;
  slug: string;
}

// Convert DB professional to Memo23Agent format for the dossier component
function convertToMemo23Agent(dbProf: DBProfessional): Memo23Agent {
  const ratingsObj = dbProf.ratings as any;
  const agentSalesStats = dbProf.agent_sales_stats as any;

  return {
    name: dbProf.name,
    businessName: dbProf.company,
    profilePhotoSrc: getValidImageUrl(dbProf.image_url),
    email: dbProf.email,
    phoneNumbers: {
      cell: dbProf.phone,
      business: null,
    },
    ratings: ratingsObj ? {
      average: ratingsObj.average || dbProf.review_stars_rating,
      count: ratingsObj.count || dbProf.num_total_reviews,
    } : {
      average: dbProf.review_stars_rating,
      count: dbProf.num_total_reviews,
    },
    agentSalesStats: agentSalesStats ? {
      countAllTime: agentSalesStats.countAllTime || dbProf.total_sales,
      countLastYear: agentSalesStats.countLastYear,
      priceRangeThreeYearMin: agentSalesStats.priceRangeThreeYearMin,
      priceRangeThreeYearMax: agentSalesStats.priceRangeThreeYearMax,
      averageValueThreeYear: agentSalesStats.averageValueThreeYear,
    } : {
      countAllTime: dbProf.total_sales,
      countLastYear: null,
      priceRangeThreeYearMin: null,
      priceRangeThreeYearMax: null,
      averageValueThreeYear: null,
    },
    forSaleListings: {
      listing_count: dbProf.current_listings,
    },
    getToKnowMe: {
      description: dbProf.get_to_know_me,
      specialties: dbProf.specialty,
      websiteUrl: dbProf.website,
    },
  };
}

// Convert DB professional to license info
function convertToLicense(dbProf: DBProfessional, stateName: string): StateLicense | null {
  if (!dbProf.license_number) return null;
  
  const agencyNames: Record<string, string> = {
    'Arizona': 'Arizona Dept. of Real Estate',
    'California': 'California DRE',
    'Texas': 'Texas Real Estate Commission',
    'Florida': 'Florida DBPR',
    'New York': 'NY Dept. of State',
    'Colorado': 'Colorado DORA',
  };

  return {
    licenseNumber: dbProf.license_number,
    licenseType: dbProf.license_type,
    originalIssueDate: dbProf.license_issued_at,
    agencyName: agencyNames[stateName] || `${stateName} Real Estate Commission`,
  };
}

// Extract reviews from platform_reviews
function extractReviews(dbProf: DBProfessional): Review[] {
  const platformReviews = dbProf.platform_reviews as any;
  if (!platformReviews?.reviews) return [];

  return platformReviews.reviews.slice(0, 6).map((r: any) => ({
    text: r.reviewComment || r.text || '',
    rating: r.rating,
    createdAt: r.createDate || r.createdAt,
  }));
}

function convertToProfessional(dbProf: DBProfessional): Professional {
  const ratingsObj = dbProf.ratings as any;
  const rating = (ratingsObj?.average && typeof ratingsObj.average === 'number' && ratingsObj.average > 0)
    ? ratingsObj.average
    : (typeof dbProf.review_stars_rating === 'number' && dbProf.review_stars_rating > 0)
      ? dbProf.review_stars_rating
      : 0;
  
  const reviews = (ratingsObj?.count && typeof ratingsObj.count === 'number' && ratingsObj.count > 0)
    ? ratingsObj.count
    : (typeof dbProf.num_total_reviews === 'number' && dbProf.num_total_reviews > 0)
      ? dbProf.num_total_reviews
      : 0;
  
  const stats: Record<string, number | string> = {};
  if (typeof dbProf.years_experience === 'number' && dbProf.years_experience > 0) {
    stats.yearsExperience = dbProf.years_experience;
  }
  
  const currentListings = (typeof dbProf.current_listings === 'number' && dbProf.current_listings > 0)
    ? dbProf.current_listings
    : 0;
    
  const totalSales = (typeof dbProf.total_sales === 'number' && dbProf.total_sales > 0)
    ? dbProf.total_sales
    : 0;
    
  if (currentListings > 0) stats.currentListings = currentListings;
  if (totalSales > 0) stats.totalSales = totalSales;
  
  const base: Professional = {
    id: dbProf.id,
    rank: dbProf.rank,
    name: dbProf.name,
    title: dbProf.title || undefined,
    company: dbProf.company || '',
    rating: rating,
    reviews: reviews,
    specialties: dbProf.specialty || [],
    address: (dbProf as any).address || '',
    phone: dbProf.phone || undefined,
    email: dbProf.email || undefined,
    website: dbProf.website || undefined,
    description: (dbProf as any).synthesized_bio || (dbProf as any).get_to_know_me || dbProf.description || '',
    stats,
    verified: !!(dbProf.license_number || dbProf.license_verified_at),
    image: getValidImageUrl(dbProf.image_url),
    testimonials: [],
    zuid: dbProf.zuid || null,
    license_number: dbProf.license_number || undefined,
    license_verified_at: dbProf.license_verified_at || undefined,
  };

  const enriched: any = {
    ...base,
    total_sales: (typeof dbProf.total_sales === 'number' ? dbProf.total_sales : undefined),
    current_listings: (typeof dbProf.current_listings === 'number' ? dbProf.current_listings : undefined),
    years_experience: (typeof dbProf.years_experience === 'number' ? dbProf.years_experience : undefined),
    zillow_data_fetched_at: dbProf.zillow_data_fetched_at || undefined,
    zillow_profile_url: dbProf.zillow_profile_url || undefined,
    sidebar_video_url: dbProf.sidebar_video_url || undefined,
    professional_information: (dbProf as any).professional_information || undefined,
    ratings: dbProf.ratings || undefined,
    get_to_know_me: (dbProf as any).get_to_know_me || undefined,
    original_description: dbProf.description || undefined,
    agent_sales_stats: (dbProf as any).agent_sales_stats || undefined,
    notable_achievements: (dbProf as any).notable_achievements || undefined,
    press_mentions: (dbProf as any).press_mentions || undefined,
    synthesized_bio: (dbProf as any).synthesized_bio || undefined,
    publications: (dbProf as any).publications || undefined,
    social_linkedin: dbProf.social_linkedin || undefined,
    social_facebook: dbProf.social_facebook || undefined,
    social_instagram: dbProf.social_instagram || undefined,
  };

  return enriched;
}

export default function CanonicalAgentProfile() {
  const { stateSlug, canonicalSlug } = useParams<{ 
    stateSlug: string; 
    canonicalSlug: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [city, setCity] = useState<City | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [verifiedAgent, setVerifiedAgent] = useState<VerifiedAgent | null>(null);
  const [rawDbProf, setRawDbProf] = useState<DBProfessional | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchAgent = async () => {
      if (!stateSlug || !canonicalSlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Query professional by state_slug + canonical_slug (uses the new index)
        const { data: agent, error: agentError } = await supabase
          .from('professionals')
          .select('*')
          .eq('state_slug', stateSlug)
          .eq('canonical_slug', canonicalSlug)
          .eq('active', true)
          .maybeSingle();

        if (agentError || !agent) {
          console.log('[CanonicalAgentProfile] Agent not found:', { stateSlug, canonicalSlug, error: agentError });
          setNotFound(true);
          setLoading(false);
          return;
        }

        // Store raw DB professional
        setRawDbProf(agent as DBProfessional);

        // Fetch city info
        const { data: cityData, error: cityError } = await supabase
          .from('cities')
          .select('*')
          .eq('id', agent.city_id)
          .single();

        if (cityError || !cityData) {
          console.log('[CanonicalAgentProfile] City not found:', agent.city_id);
          setNotFound(true);
          setLoading(false);
          return;
        }

        setCity(cityData);

        // Fetch category info
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('*')
          .eq('id', agent.category_id)
          .single();

        if (categoryError || !categoryData) {
          console.log('[CanonicalAgentProfile] Category not found:', agent.category_id);
          setNotFound(true);
          setLoading(false);
          return;
        }

        setCategory(categoryData);

        // Convert to Professional for existing components
        setProfessional(convertToProfessional(agent as DBProfessional));
        
        // Convert to VerifiedAgent for enhanced schema
        const stateAbbrev = cityData.state === 'Arizona' ? 'AZ' : cityData.state.substring(0, 2).toUpperCase();
        const verified = professionalToVerifiedAgent(
          agent,
          cityData.name,
          cityData.state,
          stateAbbrev
        );
        setVerifiedAgent(verified);
        
        setLoading(false);

      } catch (error) {
        console.error('[CanonicalAgentProfile] Error fetching agent:', error);
        setNotFound(true);
        setLoading(false);
      }
    };

    fetchAgent();
  }, [stateSlug, canonicalSlug]);

  // Generate loading state meta info from URL params
  const loadingAgentName = canonicalSlug?.replace(/-\d{4}$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Agent';
  const loadingStateName = stateSlug?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'State';
  const loadingDescription = `${loadingAgentName} is a top-rated real estate agent in ${loadingStateName}. View verified credentials, reviews, and contact information.`;

  // Canonical URL for this page
  const canonicalUrl = `https://www.top10lists.us/${stateSlug}/agents/${canonicalSlug}`;

  if (loading) {
    return (
      <>
        <Helmet>
          <title>{`${loadingAgentName} - Real Estate Agent in ${loadingStateName} | Top10Lists.us`}</title>
          <meta name="description" content={loadingDescription} />
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (notFound || !professional || !city || !category || !rawDbProf) {
    return <Navigate to="/404" replace />;
  }

  const pageTitle = `${professional.name} - ${category.name} in ${city.name}, ${city.state}`;
  const pageDescription = professional.description || 
    `${professional.name} is a top-rated ${category.name.toLowerCase()} serving ${city.name}, ${city.state}. ${professional.rating > 0 ? `Rated ${professional.rating}/5 with ${professional.reviews} reviews.` : ''}`;

  // Generate standard JSON-LD schema
  const schemaData = professionalToSchemaData(
    professional,
    city.name,
    city.state,
    city.state.substring(0, 2).toUpperCase(),
    canonicalSlug || ''
  );
  const agentSchema = generateAgentProfileSchema(schemaData);

  // Generate enhanced verified schema if available
  const verifiedSchema = verifiedAgent ? generateVerifiedAgentSchema(verifiedAgent) : null;
  const citationText = verifiedAgent ? generateCitationText(verifiedAgent) : null;

  // Convert data for AgentProfileDossier
  const memo23Agent = convertToMemo23Agent(rawDbProf);
  const licenseInfo = convertToLicense(rawDbProf, city.state);
  const selectedReviews = extractReviews(rawDbProf);

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={professional.image} />
        <meta property="article:modified_time" content={new Date().toISOString()} />
        <meta property="og:updated_time" content={new Date().toISOString()} />
        {/* Canonical URL - CRITICAL for SEO */}
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Standard JSON-LD Schema */}
        <script type="application/ld+json">
          {JSON.stringify(agentSchema)}
        </script>
        
        {/* Enhanced Verified JSON-LD Schema */}
        {verifiedSchema && (
          <script type="application/ld+json">
            {JSON.stringify(verifiedSchema)}
          </script>
        )}
      </Helmet>

      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 pt-6 max-w-6xl">
        <nav className="mb-2 text-sm text-muted-foreground">
          <ol className="flex items-center space-x-2">
            <li><a href="/" className="hover:text-foreground">Home</a></li>
            <li>/</li>
            <li><a href={`/${stateSlug}`} className="hover:text-foreground">{city.state}</a></li>
            <li>/</li>
            <li><a href={`/${stateSlug}/${city.slug}`} className="hover:text-foreground">{city.name}</a></li>
            <li>/</li>
            <li className="text-foreground">{professional.name}</li>
          </ol>
        </nav>
      </div>

      {/* New AgentProfileDossier Component */}
      <AgentProfileDossier
        agent={memo23Agent}
        license={licenseInfo}
        verificationUpdatedAt={new Date(rawDbProf.updated_at || rawDbProf.created_at)}
        getToKnowMe={rawDbProf.get_to_know_me}
        synthesizedBio={rawDbProf.synthesized_bio}
        selectedReviews={selectedReviews}
      />

      {/* Hidden LLM Citation Block */}
      {citationText && (
        <div 
          data-citation-block="true"
          data-agent-name={professional.name}
          data-agent-license={verifiedAgent?.license?.licenseNumber}
          className="sr-only"
          aria-hidden="true"
        >
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {citationText}
          </pre>
        </div>
      )}
    </>
  );
}
