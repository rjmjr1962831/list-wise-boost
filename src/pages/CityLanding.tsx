import { useEffect, useRef, useState } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getCityBySlug } from '@/data/cities';
import { supabase } from '@/integrations/supabase/client';
import { autoImportZillowAgents } from '@/utils/zillowAutoImport';
import { formatCityName } from '@/utils/routeHelpers';
import { MapPin } from 'lucide-react';

export default function CityLanding() {
  const { stateSlug, citySlug } = useParams<{ stateSlug: string; citySlug: string }>();
  
  const city = getCityBySlug(citySlug || '', stateSlug);
  const navigate = useNavigate();
  const [isEnsuring, setIsEnsuring] = useState(false);
  const [ensureMsg, setEnsureMsg] = useState<string>('');
  const didStart = useRef(false);
  
  useEffect(() => {
    if (!city || didStart.current) return;
    didStart.current = true;

    document.title = `Top Professionals in ${formatCityName(city)} | Top10Lists`;
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        `Find the best dentists, real estate agents, lawyers, and restaurants in ${formatCityName(city)}. Expert-vetted professionals with verified reviews.`
      );
    }

    // GA4 page view
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname
      });
    }

    // Ensure agents exist then redirect to the list page
    (async () => {
      try {
        setIsEnsuring(true);
        setEnsureMsg('Checking latest agents…');

        const { data: cityRow } = await supabase
          .from('cities')
          .select('*')
          .eq('slug', city.slug)
          .eq('state_slug', city.stateSlug)
          .eq('active', true)
          .single();

        const { data: categoryRow } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', 'top10realestateagents')
          .single();

        if (!cityRow || !categoryRow) {
          setIsEnsuring(false);
          return;
        }

        const { data: pros } = await supabase
          .from('professionals')
          .select('id, created_at, updated_at')
          .eq('city_id', cityRow.id)
          .eq('category_id', categoryRow.id)
          .eq('active', true)
          .order('rank', { ascending: true });

        const hasEnough = (pros?.length || 0) >= 10;
        const newestTs = Math.max(
          ...((pros || []).map(p => new Date(p.updated_at || p.created_at).getTime())),
          0
        );
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const fresh = newestTs > 0 && (Date.now() - newestTs) < THIRTY_DAYS;

        if (hasEnough && fresh) {
          navigate(`/${city.stateSlug}/${city.slug}/top10realestateagents`, { replace: true });
          return;
        }

        // Only try importing if we have less than 10 or stale data
        if (!hasEnough || !fresh) {
          setEnsureMsg('Fetching latest agents…');
          const res = await autoImportZillowAgents(cityRow.id, cityRow.name, cityRow.state);
          
          // Check if we now have agents after import
          const { data: updatedPros } = await supabase
            .from('professionals')
            .select('id')
            .eq('city_id', cityRow.id)
            .eq('category_id', categoryRow.id)
            .eq('active', true)
            .limit(1);
          
          if ((updatedPros?.length || 0) > 0) {
            // Success - redirect to list
            navigate(`/${city.stateSlug}/${city.slug}/top10realestateagents`, { replace: true });
          } else {
            // Failed to get any agents - show error, don't loop
            setEnsureMsg('Unable to load agents at this time. API providers are unavailable.');
            setIsEnsuring(false);
          }
        } else {
          // Have enough fresh agents, go to list
          navigate(`/${city.stateSlug}/${city.slug}/top10realestateagents`, { replace: true });
        }
      } catch (e) {
        console.error('ensure agents error', e);
        setEnsureMsg('Error loading agents. Please try again later.');
        setIsEnsuring(false);
      }
    })();
  }, [city, navigate]);

  if (!city) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-primary/10 rounded-full">
              <MapPin className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{formatCityName(city)}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Finding Top-Rated Real Estate Agents in {city.name}
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Finding the Best Real Estate Agents in {city.name}
            </p>
            <div className="mt-6 flex justify-center">
              {isEnsuring ? (
                <div className="flex flex-col items-center gap-6 text-center max-w-xl p-8 bg-card/50 border border-primary/20 rounded-2xl animate-scale-in">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 animate-pulse">
                    <span className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" aria-hidden="true" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-xl font-semibold text-foreground">{ensureMsg || 'Preparing list…'}</p>
                    {ensureMsg.includes('Fetching') && (
                      <div className="space-y-2">
                        <p className="text-3xl font-bold text-primary animate-pulse">2,000,000+</p>
                        <p className="text-sm text-muted-foreground">
                          data points being analyzed to find top agents
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Button asChild size="lg">
                  <Link to={`/${city.stateSlug}/${city.slug}/top10realestateagents`}>
                    See Top Real Estate Agents in {city.name}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="py-12 bg-muted/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Listed?</h2>
          <p className="text-muted-foreground mb-6">
            Join hundreds of top professionals already featured on Top10Lists.us
          </p>
          <Button asChild size="lg">
            <Link to="/agent-onboarding">Apply Now</Link>
          </Button>
          
          <div className="mt-4 flex justify-center gap-6">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
