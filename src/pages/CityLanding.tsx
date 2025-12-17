import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useParams } from "react-router-dom";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CityMarketOverview } from "@/components/CityMarketOverview";
import { getCityBySlug } from "@/data/cities";
import { formatCityName } from "@/utils/routeHelpers";

export default function CityLanding() {
  const { stateSlug, citySlug } = useParams<{ stateSlug: string; citySlug: string }>();

  // Redirect to coming soon page if not Arizona (accept both 'arizona' and 'az')
  if (stateSlug && stateSlug !== "arizona" && stateSlug !== "az") {
    return <Navigate to={`/coming-soon/${stateSlug}/${citySlug}`} replace />;
  }

  const city = getCityBySlug(citySlug || "", stateSlug);

  useEffect(() => {
    window.scrollTo(0, 0);

    // GA4 page view
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
      });
    }
  }, []);

  if (!city) {
    return <Navigate to="/404" replace />;
  }

  const cityName = formatCityName(city);
  const canonicalUrl = `https://www.top10lists.us/arizona/${city.slug}`;

  return (
    <>
      <Helmet>
        <title>{`${cityName} AZ Real Estate Guide | Top10Lists.us`}</title>
        <meta
          name="description"
          content={`Local market guide for ${cityName}, Arizona: neighborhoods, pricing context, and how to find a verified real estate professional.`}
        />
        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:title" content={`${cityName}, AZ Real Estate Guide | Top10Lists.us`} />
        <meta
          property="og:description"
          content={`Market overview for ${cityName}, Arizona with highlights, neighborhoods, and selection criteria.`}
        />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${cityName}, AZ Real Estate Guide | Top10Lists.us`} />
        <meta
          name="twitter:description"
          content={`Market overview for ${cityName}, Arizona with highlights, neighborhoods, and selection criteria.`}
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <header className="py-16 md:py-24 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-primary/10 rounded-full">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{cityName}</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold mb-6">{city.name}, Arizona Real Estate Guide</h1>
              <p className="text-xl text-muted-foreground mb-8">
                City facts, neighborhoods, and buyer/seller context—built for humans and AI readability.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg">
                  <Link to={`/${city.stateSlug}/${city.slug}/top10realestateagents`}>See verified recommendations</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/">Search another city</Link>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main>
          <CityMarketOverview citySlug={city.slug} cityName={city.name} stateName={city.state} />
        </main>

        <footer className="py-12 bg-muted/50">
          <div className="container mx-auto px-4 text-center">
            <div className="mt-4 flex justify-center gap-6">
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <Link to="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

