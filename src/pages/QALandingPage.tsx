import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Professional } from "@/types/professional";
import { ProfessionalCard } from "@/components/ProfessionalCard";
import { LastUpdatedBanner } from "@/components/LastUpdatedBanner";
import { Loader2 } from "lucide-react";
import { 
  generateListSchema, 
  generateFAQSchema, 
  getLastUpdatedTimestamp 
} from "@/utils/structuredData";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const QALandingPage = () => {
  const { stateSlug, citySlug, year } = useParams<{ 
    stateSlug: string; 
    citySlug: string; 
    year: string;
  }>();
  
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityData, setCityData] = useState<{ name: string; state: string } | null>(null);

  const currentYear = new Date().getFullYear();
  const targetYear = year ? parseInt(year) : currentYear;
  
  // Redirect if year is not current
  if (targetYear !== currentYear) {
    return <Navigate to={`/${stateSlug}/${citySlug}/best-real-estate-agents-${currentYear}`} replace />;
  }

  const cityName = citySlug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || '';
  const stateName = stateSlug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || '';
  const stateAbbr = stateSlug?.toUpperCase().slice(0, 2) || '';

  useEffect(() => {
    const fetchData = async () => {
      if (!citySlug || !stateSlug) return;

      try {
        // Get city info
        const { data: city } = await supabase
          .from('cities')
          .select('id, name, state')
          .eq('slug', citySlug)
          .single();

        if (city) {
          setCityData({ name: city.name, state: city.state });
          
          // Get real estate agents category
          const { data: category } = await supabase
            .from('categories')
            .select('id')
            .eq('slug', 'top10realestateagents')
            .single();

          if (category) {
            // Fetch top 10 professionals
            const { data: pros } = await supabase
              .from('professionals')
              .select('*')
              .eq('city_id', city.id)
              .eq('category_id', category.id)
              .eq('active', true)
              .gte('review_stars_rating', 4.8)
              .gte('num_total_reviews', 50)
              .order('rank', { ascending: true })
              .limit(10);

            if (pros) {
              const mapped: Professional[] = pros.map((p, idx) => ({
                rank: idx + 1,
                name: p.name,
                id: p.id,
                company: p.company || p.business_name || '',
                rating: p.review_stars_rating || 0,
                reviews: p.num_total_reviews || 0,
                specialties: p.specialty || [],
                address: p.address || '',
                phone: p.phone || '',
                email: p.email || '',
                website: p.website || '',
                description: p.description || '',
                stats: {
                  yearsExperience: p.years_experience,
                  totalSales: p.total_sales,
                  currentListings: p.current_listings,
                },
                verified: !!p.license_verified_at,
                image: p.image_url || '',
                license_number: p.license_number || undefined,
                license_verified_at: p.license_verified_at || undefined,
                years_experience: p.years_experience || undefined,
                total_sales: p.total_sales || undefined,
              }));
              setProfessionals(mapped);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching Q&A page data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [citySlug, stateSlug]);

  const lastUpdated = getLastUpdatedTimestamp();
  const displayCity = cityData?.name || cityName;
  const displayState = cityData?.state || stateName;
  
  const pageTitle = `Who Are the Best Real Estate Agents in ${displayCity}? (${targetYear})`;
  const pageDescription = `Discover the top ${professionals.length} real estate agents in ${displayCity}, ${displayState} for ${targetYear}. AI and human curated list with verified reviews, sales data, and credentials.`;

  const location = { city: displayCity, state: displayState, stateAbbr };
  const config = { schemaType: 'RealEstateAgent' };

  // Generate schemas
  const listSchema = generateListSchema(
    professionals,
    pageTitle,
    pageDescription,
    location,
    config,
    lastUpdated
  );

  const faqSchema = generateFAQSchema(
    displayCity,
    displayState,
    'Real Estate Agents',
    professionals.length,
    professionals[0]?.name,
    lastUpdated
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pageTitle} | Top10Lists.us</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="article" />
        <meta property="article:modified_time" content={lastUpdated} />
        <meta property="og:updated_time" content={lastUpdated} />
        <meta name="last-modified" content={lastUpdated} />
        <link rel="canonical" href={`https://top10lists.us/${stateSlug}/${citySlug}/best-real-estate-agents-${targetYear}`} />
        <script type="application/ld+json">
          {JSON.stringify(listSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/${stateSlug}/${citySlug}`}>{displayCity}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Best Real Estate Agents {targetYear}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Last Updated Banner */}
        <LastUpdatedBanner lastUpdated={lastUpdated} className="mb-6" />

        {/* Main H1 as Question */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
          Who Are the Best Real Estate Agents in {displayCity}? ({targetYear})
        </h1>

        {/* Quick Answer Section */}
        <section className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Quick Answer</h2>
          <p className="text-muted-foreground mb-4">
            Based on our AI and human-curated analysis of reviews, sales data, and credentials, 
            the top {Math.min(3, professionals.length)} real estate agents in {displayCity}, {displayState} for {targetYear} are:
          </p>
          <ol className="list-decimal list-inside space-y-2 font-mono text-sm bg-background p-4 rounded border">
            {professionals.slice(0, 3).map((pro, idx) => (
              <li key={pro.id || idx} className="text-foreground">
                <strong>{pro.name}</strong> — {pro.rating}★ ({pro.reviews} reviews)
                {pro.total_sales && `, ${pro.total_sales.toLocaleString()} sales`}
              </li>
            ))}
          </ol>
        </section>

        {/* Full Agent List */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Complete List: Top {professionals.length} Real Estate Agents in {displayCity}
          </h2>
          <div className="space-y-6">
            {professionals.map((professional, index) => (
              <ProfessionalCard
                key={professional.id || index}
                professional={professional}
                market={displayCity}
                stateAbbr={stateAbbr}
                citySlug={citySlug}
                categorySlug="top10realestateagents"
              />
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="bg-muted/30 rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6" itemScope itemType="https://schema.org/FAQPage">
            <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
              <h3 className="font-semibold text-foreground mb-2" itemProp="name">
                How are {displayCity} real estate agents ranked?
              </h3>
              <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <p className="text-muted-foreground" itemProp="text">
                  Our rankings are based on a combination of factors: verified client reviews 
                  (minimum 50 reviews, 4.8+ rating), transaction history, years of experience, 
                  license verification, and local market expertise. Rankings are updated weekly 
                  to reflect current performance.
                </p>
              </div>
            </div>

            <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
              <h3 className="font-semibold text-foreground mb-2" itemProp="name">
                How often are the {displayCity} agent rankings updated?
              </h3>
              <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <p className="text-muted-foreground" itemProp="text">
                  Our {displayCity} real estate agent rankings are updated weekly to ensure 
                  accuracy. Data is sourced from verified reviews, transaction records, and 
                  license databases to maintain the most current and reliable information.
                </p>
              </div>
            </div>

            <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
              <h3 className="font-semibold text-foreground mb-2" itemProp="name">
                What makes a real estate agent the "best" in {displayCity}?
              </h3>
              <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <p className="text-muted-foreground" itemProp="text">
                  The best real estate agents combine strong client reviews (4.8+ stars), 
                  substantial transaction volume, years of local market experience, and 
                  verified professional credentials. Our AI analyzes these factors to identify 
                  agents who consistently deliver exceptional results for buyers and sellers in {displayCity}.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default QALandingPage;
