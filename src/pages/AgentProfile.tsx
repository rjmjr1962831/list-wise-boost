import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Professional } from '@/types/professional';
import { generateAgentSlug } from '@/utils/routeHelpers';
import { generateAgentProfileSchema, professionalToSchemaData } from '@/utils/agentSchema';
import { generateVerifiedAgentSchema, generateCitationText } from '@/utils/verifiedAgentSchema';
import { professionalToVerifiedAgent } from '@/utils/professionalToVerifiedAgent';
import { VerifiedAgent } from '@/types/verifiedAgent';
import {
  LicenseCard,
  ReviewsCard,
  PressMentionsCard,
  AwardsCard,
  CertificationsCard,
  CardFooter,
} from '@/components/verified';

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
    description: (dbProf as any).get_to_know_me || dbProf.description || '',
    stats,
    verified: !!(dbProf.license_number || dbProf.license_verified_at),
    image: dbProf.image_url || '/api/placeholder/400/400',
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

export default function AgentProfile() {
  const { stateSlug, citySlug, categorySlug, agentSlug } = useParams<{ 
    stateSlug: string; 
    citySlug: string; 
    categorySlug: string;
    agentSlug: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [city, setCity] = useState<City | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [verifiedAgent, setVerifiedAgent] = useState<VerifiedAgent | null>(null);
  const [rawDbProf, setRawDbProf] = useState<DBProfessional | null>(null);

  useEffect(() => {
    const fetchAgent = async () => {
      if (!stateSlug || !citySlug || !categorySlug || !agentSlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Fetch city
        const { data: cityData, error: cityError } = await supabase
          .from('cities')
          .select('*')
          .eq('slug', citySlug)
          .eq('state_slug', stateSlug)
          .eq('active', true)
          .single();

        if (cityError || !cityData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setCity(cityData);

        // Fetch category
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('*')
          .eq('slug', categorySlug)
          .eq('active', true)
          .single();

        if (categoryError || !categoryData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setCategory(categoryData);

        // Fetch professionals for this city/category
        const { data: professionals, error: profError } = await supabase
          .from('professionals')
          .select('*')
          .eq('city_id', cityData.id)
          .eq('category_id', categoryData.id)
          .eq('active', true);

        if (profError || !professionals || professionals.length === 0) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // Find the agent by matching slug
        const agent = professionals.find((p: any) => 
          generateAgentSlug(p.name) === agentSlug
        );

        if (!agent) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // Store raw DB professional for verified transformation
        setRawDbProf(agent as DBProfessional);
        
        // Convert to Professional for existing components
        setProfessional(convertToProfessional(agent as DBProfessional));
        
        // Convert to VerifiedAgent for new components
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
        console.error('Error fetching agent:', error);
        setNotFound(true);
        setLoading(false);
      }
    };

    fetchAgent();
  }, [stateSlug, citySlug, categorySlug, agentSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !professional || !city || !category) {
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
    agentSlug || ''
  );
  const agentSchema = generateAgentProfileSchema(schemaData);

  // Generate enhanced verified schema if available
  const verifiedSchema = verifiedAgent ? generateVerifiedAgentSchema(verifiedAgent) : null;
  const citationText = verifiedAgent ? generateCitationText(verifiedAgent) : null;

  // Check if we have enhanced verified data to display
  const hasVerifiedData = verifiedAgent && (
    verifiedAgent.license?.licenseNumber ||
    verifiedAgent.aggregatedRating?.platformBreakdown?.length > 0 ||
    verifiedAgent.certifications?.length > 0 ||
    verifiedAgent.awards?.length > 0 ||
    verifiedAgent.pressMentions?.length > 0
  );

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="profile" />
        <meta property="og:image" content={professional.image} />
        <meta property="article:modified_time" content={new Date().toISOString()} />
        <meta property="og:updated_time" content={new Date().toISOString()} />
        <link rel="canonical" href={`https://top10lists.us/${stateSlug}/${citySlug}/${categorySlug}/${agentSlug}`} />
        
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

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumbs */}
        <nav className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center space-x-2">
            <li><a href="/" className="hover:text-foreground">Home</a></li>
            <li>/</li>
            <li><a href={`/${stateSlug}/${citySlug}`} className="hover:text-foreground">{city.name}</a></li>
            <li>/</li>
            <li><a href={`/${stateSlug}/${citySlug}/${categorySlug}`} className="hover:text-foreground">{category.plural_name}</a></li>
            <li>/</li>
            <li className="text-foreground">{professional.name}</li>
          </ol>
        </nav>

        {/* Main Profile Card */}
        <ProfessionalCard
          professional={professional}
          accentColor="primary"
          schemaType="RealEstateAgent"
          market={`${city.name}, ${city.state}`}
          stateAbbr={city.state}
          citySlug={citySlug}
          categorySlug={categorySlug}
          quizCompleted={true}
        />

        {/* Verified Data Sections */}
        {hasVerifiedData && verifiedAgent && (
          <div className="mt-8 space-y-6">
            <h2 className="text-xl font-semibold border-b pb-2">Verified Credentials & Data</h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              {/* License Card */}
              {verifiedAgent.license?.licenseNumber && verifiedAgent.license.licenseNumber !== 'N/A' && (
                <LicenseCard 
                  license={verifiedAgent.license}
                  brokerage={verifiedAgent.brokerage?.value}
                />
              )}
              
              {/* Reviews Card */}
              {verifiedAgent.aggregatedRating?.platformBreakdown?.length > 0 && (
                <ReviewsCard rating={verifiedAgent.aggregatedRating} />
              )}
            </div>

            {/* Certifications */}
            {verifiedAgent.certifications?.length > 0 && (
              <CertificationsCard certifications={verifiedAgent.certifications} />
            )}

            {/* Awards */}
            {verifiedAgent.awards?.length > 0 && (
              <AwardsCard awards={verifiedAgent.awards} />
            )}

            {/* Press Mentions */}
            {verifiedAgent.pressMentions?.length > 0 && (
              <PressMentionsCard mentions={verifiedAgent.pressMentions} />
            )}

            {/* Card Footer with Data Sources */}
            <CardFooter
              cardCreatedAt={verifiedAgent.cardCreatedAt}
              cardUpdatedAt={verifiedAgent.cardUpdatedAt}
              dataSources={verifiedAgent.dataSources}
            />
          </div>
        )}

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
      </div>
    </>
  );
}
