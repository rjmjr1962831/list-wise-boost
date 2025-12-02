import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Bell } from "lucide-react";
import { useEffect } from "react";

const CityComingSoon = () => {
  const { stateSlug, citySlug } = useParams<{ stateSlug: string; citySlug: string }>();
  const navigate = useNavigate();

  // Format city name from slug
  const formatCityName = (slug: string = "") => {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const cityName = formatCityName(citySlug);
  const stateName = formatCityName(stateSlug);

  useEffect(() => {
    // Set page title
    document.title = `${cityName}, ${stateName} - Coming Soon | Top10Lists.us`;
  }, [cityName, stateName]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="p-8 max-w-2xl w-full text-center">
        <MapPin className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-4">
          {cityName}, {stateName}
        </h1>
        <h2 className="text-2xl font-semibold text-muted-foreground mb-6">
          Coming Soon!
        </h2>
        <p className="text-lg text-muted-foreground mb-6">
          We're expanding our network of top-rated real estate agents to {cityName}. 
          Our team is currently researching and verifying the best real estate agents 
          in your area.
        </p>
        <div className="bg-muted/50 rounded-lg p-6 mb-6">
          <Bell className="h-8 w-8 text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Want to be notified when {cityName} goes live? Or know a top professional 
            who should be featured? Email us at{" "}
            <a 
              href="mailto:hello@top10lists.us" 
              className="text-primary hover:underline font-medium"
            >
              hello@top10lists.us
            </a>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate("/")} variant="default" size="lg">
            Explore Available Cities
          </Button>
          <Button 
            onClick={() => navigate("/join")} 
            variant="outline" 
            size="lg"
          >
            List Your Business
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          Currently serving: Arizona (Phoenix, Scottsdale, Gilbert, Mesa & more)
        </p>
      </Card>
    </div>
  );
};

export default CityComingSoon;
