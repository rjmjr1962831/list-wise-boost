import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";

const majorCities = [
  { name: "Phoenix", slug: "phoenix" },
  { name: "Scottsdale", slug: "scottsdale" },
  { name: "Mesa", slug: "mesa" },
  { name: "Tucson", slug: "tucson" },
  { name: "Chandler", slug: "chandler" },
  { name: "Gilbert", slug: "gilbert" },
  { name: "Tempe", slug: "tempe" },
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
    <section id="browse-cities" className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">
              Browse Arizona Cities
            </h2>
          </div>
          <p className="text-muted-foreground">
            48 cities covered • Top 10 agents in each
          </p>
        </div>

        {/* City Quick Links - 2 rows of 4 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {majorCities.map((city) => (
            <Link
              key={city.slug}
              to={`/arizona/${city.slug}/top10realestateagents`}
              className="px-4 py-3 bg-card rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-center font-medium"
              onClick={() => handleCityClick(city.name)}
            >
              {city.name}
            </Link>
          ))}
        </div>

        <div className="text-center space-y-3">
          <Link 
            to="/#search" 
            className="text-sm text-primary hover:underline font-medium"
            onClick={() => handleCityClick('more')}
          >
            +40 more Arizona cities →
          </Link>
          <p className="text-xs text-muted-foreground">
            Expanding to CA, TX, FL, NY, CO in 2026
          </p>
        </div>
      </div>
    </section>
  );
};
