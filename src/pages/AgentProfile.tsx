import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Professional } from '@/types/professional';
import { generateAgentSlug } from '@/utils/routeHelpers';

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

        setProfessional(convertToProfessional(agent));
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

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="profile" />
        <link rel="canonical" href={`https://top10lists.us/${stateSlug}/${citySlug}/${categorySlug}/${agentSlug}`} />
        
        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RealEstateAgent",
            "name": professional.name,
            "url": `https://top10lists.us/${stateSlug}/${citySlug}/${categorySlug}/${agentSlug}`,
            "image": professional.image,
            "description": pageDescription,
            "address": {
              "@type": "PostalAddress",
              "addressLocality": city.name,
              "addressRegion": city.state
            },
            ...(professional.rating > 0 && {
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": professional.rating.toString(),
                "reviewCount": professional.reviews.toString(),
                "bestRating": "5"
              }
            }),
            ...(professional.phone && { "telephone": professional.phone }),
            ...(professional.email && { "email": professional.email }),
            ...(professional.license_number && { "license": professional.license_number }),
            "areaServed": {
              "@type": "State",
              "name": city.state
            },
            ...(professional.specialties && professional.specialties.length > 0 && {
              "knowsAbout": [
                `${city.state} real estate`,
                ...professional.specialties
              ]
            }),
            ...((professional as any).notable_achievements && 
              Array.isArray((professional as any).notable_achievements) && 
              (professional as any).notable_achievements.length > 0 && {
              "award": (professional as any).notable_achievements
                .filter((a: any) => a?.title || a?.text)
                .map((a: any) => a.title || a.text)
                .slice(0, 5)
            }),
            ...((() => {
              const sameAs: string[] = [];
              if ((professional as any).zillow_profile_url) {
                sameAs.push((professional as any).zillow_profile_url);
              }
              if ((professional as any).social_linkedin) {
                sameAs.push((professional as any).social_linkedin);
              }
              if ((professional as any).social_facebook) {
                sameAs.push((professional as any).social_facebook);
              }
              if ((professional as any).social_instagram) {
                sameAs.push((professional as any).social_instagram);
              }
              return sameAs.length > 0 ? { "sameAs": sameAs } : {};
            })())
          })}
        </script>
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
      </div>
    </>
  );
}
