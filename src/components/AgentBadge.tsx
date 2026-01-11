import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ShieldCheck, ExternalLink, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { Professional } from "@/types/professional";
import { getValidImageUrl } from "@/utils/imageUrlValidator";

interface AgentBadgeProps {
  professional: Professional;
  stateSlug: string;
  citySlug?: string;
  rank?: number;
  accentColor?: "primary" | "sunset-orange" | "terracotta" | "turquoise" | "cactus-green";
  /** Whether this agent is a paid neighborhood expert */
  isPaidExpert?: boolean;
}

export const AgentBadge = ({
  professional,
  stateSlug,
  citySlug,
  rank,
  accentColor = "primary",
  isPaidExpert = false
}: AgentBadgeProps) => {
  const isVerified = !!(professional.license_number || (professional as any).license_verified_at);
  
  // Generate profile URL
  const generateProfileUrl = () => {
    const canonicalSlug = (professional as any).canonical_slug;
    if (canonicalSlug) {
      return `/${stateSlug}/agents/${canonicalSlug}`;
    }
    // Fallback: construct from name and phone
    const namePart = professional.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const phoneLast4 = professional.phone?.replace(/\D/g, '').slice(-4) || '0000';
    return `/${stateSlug}/${citySlug || 'agents'}/top10realestateagents/${namePart}-${phoneLast4}`;
  };

  const profileUrl = generateProfileUrl();
  const imageUrl = getValidImageUrl((professional as any).image_url || professional.image);
  
  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const rating = professional.rating || (professional as any).review_stars_rating || 0;
  const reviews = professional.reviews || (professional as any).num_total_reviews || 0;
  const yearsExp = professional.years_experience || (professional as any).stats?.yearsExperience;

  const getGradientClass = (color: string) => {
    const gradients: Record<string, string> = {
      primary: "from-primary/5 to-turquoise/5",
      "sunset-orange": "from-sunset-orange/5 to-terracotta/5",
      terracotta: "from-terracotta/5 to-desert-sand/5",
      turquoise: "from-turquoise/5 to-primary/5",
      "cactus-green": "from-cactus-green/5 to-turquoise/5"
    };
    return gradients[color] || gradients.primary;
  };

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-0.5",
        "border border-border/50 hover:border-primary/30",
        `bg-gradient-to-br ${getGradientClass(accentColor)}`
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={professional.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-background shadow-md"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={cn(
                "w-14 h-14 rounded-full bg-gradient-to-br from-primary to-turquoise flex items-center justify-center text-white font-semibold text-lg border-2 border-background shadow-md",
                imageUrl ? "hidden" : ""
              )}>
                {getInitials(professional.name)}
              </div>
              
              {/* Verified badge overlay */}
              {isVerified && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                  <ShieldCheck className="h-4 w-4 text-cactus-green" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {professional.name}
                </h3>
              </div>
              
              {professional.company && (
                <p className="text-sm text-muted-foreground truncate">
                  {professional.company}
                </p>
              )}

              {/* Rating and Experience */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {/* Neighborhood Expert Badge - Only for paid experts */}
                {isPaidExpert && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                    <Award className="h-3 w-3 mr-1" />
                    Neighborhood Expert
                  </Badge>
                )}
                
                {rating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{rating.toFixed(1)}</span>
                    {reviews > 0 && (
                      <span className="text-xs text-muted-foreground">({reviews})</span>
                    )}
                  </div>
                )}
                
                {yearsExp && yearsExp > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {yearsExp}+ years
                  </Badge>
                )}
              </div>
            </div>

            {/* View Profile Arrow */}
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
};
