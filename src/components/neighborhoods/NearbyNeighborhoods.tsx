import { Link } from "react-router-dom";

interface NearbyNeighborhood {
  id: string;
  slug: string;
  name: string;
  tier: "Main" | "Prime" | "Luxury";
  city_area: string;
  distance_miles: number;
}

interface NearbyNeighborhoodsProps {
  neighborhoods: NearbyNeighborhood[];
  currentState: string; // e.g., "arizona"
  currentCity: string;  // e.g., "phoenix"
}

const tierColors: Record<string, string> = {
  Main: "bg-slate-100 text-slate-700",
  Prime: "bg-blue-100 text-blue-700",
  Luxury: "bg-amber-100 text-amber-700",
};

const tierPrices: Record<string, string> = {
  Main: "$39",
  Prime: "$69",
  Luxury: "$99",
};

export const NearbyNeighborhoods = ({ 
  neighborhoods, 
  currentState,
  currentCity 
}: NearbyNeighborhoodsProps) => {
  if (!neighborhoods || neighborhoods.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Nearby Neighborhoods
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {neighborhoods.map((neighborhood) => (
          <Link
            key={neighborhood.id}
            to={`/${currentState}/${neighborhood.city_area.toLowerCase().replace(/\s+/g, '-')}/${neighborhood.slug}/top10realestateagents`}
            className="block p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">
                  {neighborhood.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {neighborhood.city_area}
                  {neighborhood.city_area.toLowerCase().replace(/\s+/g, '-') !== currentCity.toLowerCase() && (
                    <span className="ml-1 text-primary">(nearby city)</span>
                  )}
                </p>
              </div>
              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded ${tierColors[neighborhood.tier] || tierColors.Main}`}>
                {neighborhood.tier}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {neighborhood.distance_miles === 0 
                  ? "Adjacent" 
                  : `${neighborhood.distance_miles.toFixed(1)} mi`}
              </span>
              <span className="text-muted-foreground font-medium">
                {tierPrices[neighborhood.tier] || tierPrices.Main}/mo
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
