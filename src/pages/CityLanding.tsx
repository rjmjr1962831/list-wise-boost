import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useNavigate, useParams, useLocation } from "react-router-dom";
import { MapPin, Search, ArrowLeft, Users, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CityMarketOverview } from "@/components/CityMarketOverview";
import { formatCityName } from "@/utils/routeHelpers";
import { normalizeStateSlug } from "@/utils/stateSlugMapping";

type CityRow = {
  id: string;
  name: string;
  slug: string;
  state: string;
  state_slug: string;
};

export default function CityLanding() {
  const { stateSlug, citySlug } = useParams<{ stateSlug: string; citySlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // ALL HOOKS MUST BE ABOVE ANY CONDITIONAL RETURNS
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

  // Normalize state slug - redirect if using abbreviation (e.g., /az/ -> /arizona/)
  const stateNormalized = stateSlug ? normalizeStateSlug(stateSlug) : null;
  const normalizedStateSlug = stateNormalized?.normalized || stateSlug || "";
  const needsStateRedirect = !!(stateSlug && stateNormalized?.needsRedirect);

  // Redirect to coming soon page unless Arizona, California, or Albuquerque (New Mexico)
  const stateSlugLower = normalizedStateSlug.toLowerCase();
  const citySlugLower = (citySlug || "").toLowerCase();
  const isAllowed =
    stateSlugLower === "arizona" ||
    stateSlugLower === "california" ||
    (stateSlugLower === "new-mexico" && citySlugLower === "albuquerque");

  const { data: city, isLoading: isCityLoading } = useQuery({
    queryKey: ["city-row", normalizedStateSlug, citySlugLower],
    queryFn: async (): Promise<CityRow | null> => {
      if (!normalizedStateSlug || !citySlugLower) return null;

      const { data, error } = await supabase
        .from("cities")
        .select("id,name,slug,state,state_slug")
        .eq("state_slug", normalizedStateSlug.toLowerCase())
        .eq("slug", citySlugLower)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: !!normalizedStateSlug && !!citySlugLower && !needsStateRedirect && isAllowed,
    staleTime: 1000 * 60 * 10,
  });

  const { data: stateCities = [] } = useQuery({
    queryKey: ["cities-by-state", normalizedStateSlug, searchQuery],
    queryFn: async (): Promise<CityRow[]> => {
      if (!normalizedStateSlug) return [];

      let query = supabase
        .from("cities")
        .select("id,name,slug,state,state_slug")
        .eq("state_slug", normalizedStateSlug.toLowerCase())
        .order("name", { ascending: true })
        .limit(50);

      if (searchQuery.trim()) {
        query = query.ilike("name", `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).filter((c) => c.slug !== citySlugLower);
    },
    enabled: !!normalizedStateSlug && !needsStateRedirect,
    staleTime: 1000 * 60 * 10,
  });

  // If state slug is an abbreviation, redirect to canonical full name URL
  // This must be AFTER all hooks
  if (needsStateRedirect) {
    const newPath = `/${normalizedStateSlug}/${citySlug}`;
    console.log(
      `[StateSlugRedirect] Redirecting from /${stateSlug}/ to /${normalizedStateSlug}/`
    );
    return <Navigate to={newPath} replace />;
  }

  if (stateSlug && !isAllowed) {
    return <Navigate to={`/coming-soon/${normalizedStateSlug}/${citySlug}`} replace />;
  }

  if (isCityLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!city) {
    return <Navigate to="/404" replace />;
  }

  const handleCitySelect = (selectedCity: CityRow) => {
    setDialogOpen(false);
    setSearchQuery("");
    navigate(`/${normalizedStateSlug}/${selectedCity.slug}`);
  };

  // Determine if user came from the list page
  const listUrl = `/${normalizedStateSlug}/${city.slug}/top10realestateagents`;
  const cameFromList = location.state?.fromList || document.referrer.includes(listUrl);

  const cityName = `${city.name}, ${city.state}`;
  const canonicalUrl = `https://www.top10lists.us/${normalizedStateSlug}/${city.slug}`;

  return (
    <>
      <Helmet>
        <title>{`${city.name} ${city.state} Real Estate Guide | Top10Lists.us`}</title>
        <meta
          name="description"
          content={`Local market guide for ${cityName}: neighborhoods, pricing context, and how to find a verified real estate agent.`}
        />
        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:title" content={`${city.name} ${city.state} Real Estate Guide | Top10Lists.us`} />
        <meta
          property="og:description"
          content={`Market overview for ${cityName} with highlights, neighborhoods, and selection criteria.`}
        />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${city.name} ${city.state} Real Estate Guide | Top10Lists.us`} />
        <meta
          name="twitter:description"
          content={`Market overview for ${cityName} with highlights, neighborhoods, and selection criteria.`}
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Back to List Button - Top Right */}
        <div className="container mx-auto px-4 pt-4">
          <div className="flex justify-end">
            <Button asChild variant="outline" className="flex items-center gap-2">
              <Link to={listUrl}>
                <ArrowLeft className="h-4 w-4" />
                Back to Agent List
              </Link>
            </Button>
          </div>
        </div>
        
        <header className="py-12 md:py-20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-primary/10 rounded-full">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{cityName}</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold mb-6">{city.name}, {city.state} Real Estate Guide</h1>
              <p className="text-xl text-muted-foreground mb-8">
                City facts, neighborhoods, and buyer/seller context—built for humans and AI readability.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  size="lg" 
                  onClick={() => navigate(listUrl)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Search for an Agent
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" variant="outline">
                      <Search className="h-4 w-4 mr-2" />
                      Search another city
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Search cities in {city.state}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        placeholder="Start typing a city name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                      <ScrollArea className="h-64">
                        <div className="space-y-1">
                          {stateCities.length > 0 ? (
                            stateCities.map((c) => (
                              <button
                                key={c.slug}
                                onClick={() => handleCitySelect(c)}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-primary/10 transition-colors flex items-center gap-2"
                              >
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                {c.name}
                              </button>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No cities found matching "{searchQuery}"
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>
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
