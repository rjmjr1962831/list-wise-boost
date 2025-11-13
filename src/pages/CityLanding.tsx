import { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getCityBySlug } from '@/data/cities';
import { hasDataForCity } from '@/data/professionalData';
import { formatCityName } from '@/utils/routeHelpers';
import { MapPin } from 'lucide-react';

export default function CityLanding() {
  const { stateSlug, citySlug } = useParams<{ stateSlug: string; citySlug: string }>();
  
  const city = getCityBySlug(citySlug || '', stateSlug);
  const hasData = hasDataForCity(citySlug || '');
  
  useEffect(() => {
    if (!city) return;

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
  }, [city]);

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
              Find Top-Rated Professionals in {city.name}
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Discover the best dentists, real estate agents, lawyers, and restaurants in {formatCityName(city)}. 
              All professionals are expert-vetted with verified reviews.
            </p>
            <div className="mt-6 flex justify-center">
              <Button asChild size="lg">
                <Link to={`/${city.stateSlug}/${city.slug}/top10realestateagents`}>
                  See Top Real Estate Agents in {city.name}
                </Link>
              </Button>
            </div>
            {!hasData && (
              <div className="inline-block px-6 py-3 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg mt-6">
                <p className="text-amber-800 dark:text-amber-200 font-medium">
                  Content coming soon for {city.name}! In the meantime, explore the Top Real Estate Agents above.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Are You a Professional?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Get listed on Top10Lists and connect with potential clients in {city.name}.
          </p>
          <Button asChild size="lg">
            <Link to="/main">Apply Now</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Top10Lists. All rights reserved.</p>
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
