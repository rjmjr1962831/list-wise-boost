import { Card, CardContent } from "@/components/ui/card";
import { MapPin, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";

const majorCities = [
  { name: "Phoenix", slug: "phoenix" },
  { name: "Scottsdale", slug: "scottsdale" },
  { name: "Mesa", slug: "mesa" },
  { name: "Chandler", slug: "chandler" },
  { name: "Gilbert", slug: "gilbert" },
  { name: "Tempe", slug: "tempe" },
  { name: "Tucson", slug: "tucson" },
  { name: "Glendale", slug: "glendale" }
];

export const BrowseCitiesSection = () => {
  const { trackEvent } = useGA4Tracking();

  const handleCityClick = (cityName: string) => {
    trackEvent('city_browse_click', {
      city: cityName,
      state: 'Arizona',
      page_path: '/'
    });
  };

  return (
    <section className="container mx-auto px-4 py-16 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Browse Arizona Cities
          </h2>
          <p className="text-muted-foreground text-lg">
            48 cities covered • Top 10 agents in each
          </p>
        </div>

        {/* State Card */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Arizona</h3>
                  <p className="text-sm text-muted-foreground">48 cities covered</p>
                </div>
              </div>
              <Link 
                to="/arizona" 
                className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
                onClick={() => handleCityClick('all')}
              >
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* City Quick Links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {majorCities.map((city) => (
                <Link
                  key={city.slug}
                  to={`/arizona/${city.slug}/top10realestateagents`}
                  className="px-4 py-3 bg-background rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
                  onClick={() => handleCityClick(city.name)}
                >
                  <span className="font-medium">{city.name}</span>
                </Link>
              ))}
            </div>

            <div className="mt-4 text-center">
              <Link 
                to="/arizona" 
                className="text-sm text-muted-foreground hover:text-primary"
                onClick={() => handleCityClick('more')}
              >
                +40 more Arizona cities →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Expansion Note */}
        <p className="text-center text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
            Expanding nationwide January 2026
          </span>
        </p>
      </div>
    </section>
  );
};
