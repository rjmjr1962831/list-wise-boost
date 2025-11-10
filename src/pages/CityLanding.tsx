import { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CategoryCard } from '@/components/CategoryCard';
import { getCityBySlug } from '@/data/cities';
import { getAllCategories } from '@/data/categoryConfig';
import { hasDataForCity, getAvailableCategories, getProfessionalsByCategory } from '@/data/professionalData';
import { formatCityName } from '@/utils/routeHelpers';
import { MapPin, Home } from 'lucide-react';

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

  const allCategories = getAllCategories();
  const availableCategories = hasData ? getAvailableCategories(city.slug) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Top10Lists</span>
            </Link>
            <Button asChild variant="default">
              <Link to="/main">List Your Business</Link>
            </Button>
          </div>
        </div>
      </header>

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
            {!hasData && (
              <div className="inline-block px-6 py-3 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
                <p className="text-amber-800 dark:text-amber-200 font-medium">
                  Content coming soon for {city.name}! Check out our available cities below.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">Browse by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {allCategories.map((category) => {
              const isAvailable = availableCategories.includes(category.id);
              const professionalCount = isAvailable 
                ? getProfessionalsByCategory(city, category.id).length 
                : 0;
              
              return (
                <CategoryCard
                  key={category.id}
                  category={category}
                  city={city}
                  professionalCount={professionalCount}
                />
              );
            })}
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
