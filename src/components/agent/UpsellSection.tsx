import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpCircle, 
  MapPin, 
  Calendar, 
  TrendingUp,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpsellSectionProps {
  professional: any;
  subscriptionCount: number;
}

export function UpsellSection({ professional, subscriptionCount }: UpsellSectionProps) {
  const navigate = useNavigate();
  
  const verificationToken = professional.verification_token || professional.id;
  
  const handleAddCities = () => {
    navigate(`/profile/${verificationToken}/pricing`);
  };

  const handleViewProfile = () => {
    // Build public profile URL
    const citySlug = professional.city?.slug || professional.city_id;
    const stateSlug = professional.city?.state_slug || professional.state_slug || "arizona";
    
    // Generate profile slug from name + short_code
    const nameSlug = professional.name
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    
    const profileSlug = professional.short_code 
      ? `${nameSlug}-${professional.short_code}`
      : nameSlug;

    const profileUrl = `/${stateSlug}/${citySlug}/top10realestateagents/${profileSlug}`;
    window.open(profileUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Upgrade Options */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            Grow Your Reach
          </CardTitle>
          <CardDescription>
            Expand your visibility by adding more cities to your profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Cities Card */}
          <div 
            className="p-4 border rounded-lg bg-background hover:border-primary/50 transition-colors cursor-pointer group"
            onClick={handleAddCities}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">
                    Add More Cities
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Get listed in additional markets
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>

          {/* Annual Savings Card */}
          <div 
            className="p-4 border rounded-lg bg-background hover:border-primary/50 transition-colors cursor-pointer group"
            onClick={handleAddCities}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium group-hover:text-primary transition-colors">
                      Switch to Annual
                    </p>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                      Save 17%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Save 2 months with annual billing
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats & Value Prop */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Your Profile Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">{subscriptionCount}</p>
              <p className="text-sm text-muted-foreground">Active Cities</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {professional.review_stars_rating?.toFixed(1) || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">Star Rating</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {professional.num_total_reviews || 0}
              </p>
              <p className="text-sm text-muted-foreground">Reviews</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {professional.years_experience || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">Years Experience</p>
            </div>
          </div>

          <div className="mt-6">
            <Button variant="outline" className="w-full" onClick={handleViewProfile}>
              <Sparkles className="h-4 w-4 mr-2" />
              View Your Public Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
