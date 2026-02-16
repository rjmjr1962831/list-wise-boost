import { useParams, Navigate, Link } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CoverageConfirmationBlock } from '@/components/CoverageConfirmationBlock';

interface City {
  id: string;
  name: string;
  slug: string;
  state_slug: string;
}

// Supported states for state landing pages
const SUPPORTED_STATES: Record<string, { name: string; slug: string }> = {
  'arizona': { name: 'Arizona', slug: 'arizona' },
  'az': { name: 'Arizona', slug: 'arizona' },
  'california': { name: 'California', slug: 'california' },
  'ca': { name: 'California', slug: 'california' },
  'texas': { name: 'Texas', slug: 'texas' },
  'tx': { name: 'Texas', slug: 'texas' },
  'florida': { name: 'Florida', slug: 'florida' },
  'fl': { name: 'Florida', slug: 'florida' },
  'colorado': { name: 'Colorado', slug: 'colorado' },
  'co': { name: 'Colorado', slug: 'colorado' },
  'new-york': { name: 'New York', slug: 'new-york' },
  'ny': { name: 'New York', slug: 'new-york' },
};

// Only AZ and CA are fully enriched and should be indexed
const INDEXABLE_STATES = ['arizona', 'california'];

export default function StateLanding() {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Normalize state slug and get state info
  const stateInfo = useMemo(() => {
    const normalized = stateSlug?.toLowerCase() || '';
    return SUPPORTED_STATES[normalized] || null;
  }, [stateSlug]);

  const normalizedStateSlug = stateInfo?.slug || 'arizona';
  const stateName = stateInfo?.name || 'Arizona';

  // ALL HOOKS MUST BE ABOVE ANY CONDITIONAL RETURNS
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchCities = async () => {
      const { data } = await supabase
        .from('cities')
        .select('id, name, slug, state_slug')
        .eq('state_slug', normalizedStateSlug)
        .eq('active', true)
        .order('name');
      
      setCities(data || []);
      setIsLoading(false);
    };

    if (stateInfo) {
      fetchCities();
    } else {
      setIsLoading(false);
    }

    // GA4 page view
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: `Real Estate Agent Recommendations in ${stateName}`,
        page_location: window.location.href,
        page_path: window.location.pathname
      });
    }
  }, [normalizedStateSlug, stateInfo, stateName]);

  // Redirect unsupported states to homepage
  if (!stateInfo) {
    return <Navigate to="/" replace />;
  }

  const cityCount = cities.length || (normalizedStateSlug === 'arizona' ? 48 : 1684);
  const description = normalizedStateSlug === 'california' 
    ? `Top10Lists.us is expanding to ${stateName}. ${cityCount.toLocaleString()} cities indexed. Agent verification and neighborhood coverage coming Q1 2026.`
    : `Top10Lists.us recommends real estate agents serving ${stateName} cities. Recommendations are surfaced through our centralized discovery experience.`;

  return (
    <>
      <SafeHead>
        <title>Real Estate Agent Recommendations in {stateName} | Top10Lists.us</title>
        <meta name="description" content={description} />
        {!INDEXABLE_STATES.includes(normalizedStateSlug) && <meta name="robots" content="noindex, nofollow" />}
        <link rel="canonical" href={`https://www.top10lists.us/${normalizedStateSlug}`} />
      </SafeHead>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-primary/10 rounded-full">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{stateName}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Real Estate Agent Recommendations in {stateName}
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                {normalizedStateSlug === 'california' 
                  ? `Top10Lists.us is expanding to ${stateName}. ${cityCount.toLocaleString()} cities indexed with agent verification coming soon.`
                  : `Top10Lists.us evaluates and recommends real estate agents across ${cityCount}+ ${stateName} cities through our centralized discovery experience.`
                }
              </p>
            </div>
          </div>
        </section>

        {/* Coverage Confirmation Block */}
        <div className="container mx-auto px-4 -mt-8">
          <div className="max-w-3xl mx-auto">
            <CoverageConfirmationBlock locationName={stateName} />
          </div>
        </div>

        {/* Cities Grid - For navigation only, not listing agents */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-4 text-center">Covered Cities</h2>
            <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
              Select a city to learn more about the local market. Recommendations are provided through our homepage discovery experience.
            </p>
            {isLoading ? (
              <div className="flex justify-center">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
                {cities.map((city) => (
                  <Link
                    key={city.id}
                    to={`/${city.state_slug}/${city.slug}`}
                    className="p-4 bg-card border rounded-lg hover:border-primary transition-colors text-center"
                  >
                    <span className="font-medium">{city.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="py-12 bg-muted/50">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-4">Start Your Discovery</h2>
            <p className="text-muted-foreground mb-6">
              Use our centralized discovery experience to find verified agent recommendations.
            </p>
            <Button asChild size="lg">
              <Link to="/">Go to Discovery →</Link>
            </Button>
          </div>
        </footer>
      </div>
    </>
  );
}
