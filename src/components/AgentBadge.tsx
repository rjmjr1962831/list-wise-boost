import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ShieldCheck, ExternalLink, Award, Home, TrendingUp, Clock, BadgeCheck, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Professional } from "@/types/professional";
import { getValidImageUrl } from "@/utils/imageUrlValidator";

interface AgentSalesStats {
  countAllTime?: number;
  countLast12Months?: number;
  averageValueThreeYear?: number;
  avgSalePrice?: string;
  priceRangeThreeYearMin?: number;
  priceRangeThreeYearMax?: number;
  priceRange?: string;
  source?: string;
}

interface CommunityRole {
  organization: string;
  role: string;
  description?: string;
  url?: string;
}

interface NotableAchievement {
  title: string;
  description?: string;
  year?: number;
  source?: string;
  url?: string;
}

interface PressMention {
  title?: string;
  outlet?: string;
  url?: string;
  date?: string;
}

interface AgentBadgeProps {
  professional: Professional & {
    agent_sales_stats?: AgentSalesStats | null;
    sales_count_all_time?: number | null;
    average_value_3yr?: number | null;
    price_range_3yr_min?: number | null;
    price_range_3yr_max?: number | null;
    community_roles?: CommunityRole[] | null;
    notable_achievements?: NotableAchievement[] | null;
    awards_verified?: any[] | null;
    press_mentions?: PressMention[] | null;
  };
  stateSlug: string;
  citySlug?: string;
  rank?: number;
  accentColor?: "primary" | "sunset-orange" | "terracotta" | "turquoise" | "cactus-green";
  /** Whether this agent is a paid neighborhood expert */
  isPaidExpert?: boolean;
}

/**
 * Format currency with K/M abbreviations
 */
function formatCurrency(value: number | string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  
  // If it's already a string like "$474K", return as-is
  if (typeof value === 'string') {
    if (value.includes('$')) return value;
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) return null;
    return formatCurrencyNumber(num);
  }
  
  return formatCurrencyNumber(value);
}

function formatCurrencyNumber(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return `$${value.toLocaleString()}`;
}

/**
 * Parse price range from various formats
 */
function parsePriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  rangeString: string | null | undefined
): string | null {
  // Try numeric values first
  if (min && max && min > 0 && max > 0) {
    return `${formatCurrencyNumber(min)}-${formatCurrencyNumber(max)}`;
  }
  
  // Try string like "$100K - $1.4M"
  if (rangeString && rangeString.includes('-')) {
    return rangeString.replace(/\s/g, '');
  }
  
  return null;
}

/**
 * Deduplicate and normalize specialties
 */
function normalizeSpecialties(specialties: string[] | undefined | null): string[] {
  if (!specialties || specialties.length === 0) return [];
  
  // Normalize to title case and deduplicate
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const spec of specialties) {
    const normalized = spec.toLowerCase().replace(/[-_]/g, ' ');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      // Title case
      result.push(spec.split(/[\s-_]/).map(w => 
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' '));
    }
  }
  
  return result.slice(0, 3); // Max 3 specialties
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
  
  // Extract sales stats
  const agentStats = (professional as any).agent_sales_stats as AgentSalesStats | null;
  const totalSales = 
    professional.sales_count_all_time ||
    agentStats?.countAllTime ||
    null;
  
  const avgSalePrice = 
    formatCurrency(professional.average_value_3yr) ||
    formatCurrency(agentStats?.averageValueThreeYear) ||
    formatCurrency(agentStats?.avgSalePrice) ||
    null;
  
  const priceRange = parsePriceRange(
    professional.price_range_3yr_min,
    professional.price_range_3yr_max,
    agentStats?.priceRange
  );
  
  const specialties = normalizeSpecialties(professional.specialties || (professional as any).specialty);
  const licenseNumber = professional.license_number;

  // Check if we have any sales stats to show
  const hasSalesStats = totalSales || avgSalePrice;

  // Extract primary citation for GEO verification display
  // Priority: 1. Community role with URL, 2. Award with source, 3. Press mention with URL
  const primaryCitation = (() => {
    // Check community roles first (most compelling for "community leader" positioning)
    const communityRoles = (professional as any).community_roles as CommunityRole[] | null;
    if (communityRoles && Array.isArray(communityRoles) && communityRoles.length > 0) {
      const roleWithUrl = communityRoles.find(r => r.url);
      if (roleWithUrl) {
        return {
          text: `${roleWithUrl.role}, ${roleWithUrl.organization}`,
          url: roleWithUrl.url,
          type: 'community' as const
        };
      }
      // Even without URL, show the role
      const firstRole = communityRoles[0];
      return {
        text: `${firstRole.role}, ${firstRole.organization}`,
        url: null,
        type: 'community' as const
      };
    }
    
    // Check notable achievements / awards
    const achievements = (professional as any).notable_achievements as NotableAchievement[] | null;
    const awards = (professional as any).awards_verified;
    const achievementList = achievements || awards;
    if (achievementList && Array.isArray(achievementList) && achievementList.length > 0) {
      const first = achievementList[0];
      return {
        text: first.title || first.name || 'Recognized Achievement',
        url: first.url || null,
        type: 'award' as const
      };
    }
    
    // Check press mentions
    const pressMentions = (professional as any).press_mentions as PressMention[] | null;
    if (pressMentions && Array.isArray(pressMentions) && pressMentions.length > 0) {
      const first = pressMentions[0];
      if (first.url) {
        return {
          text: first.outlet ? `Featured in ${first.outlet}` : 'Press Feature',
          url: first.url,
          type: 'press' as const
        };
      }
    }
    
    return null;
  })();

  // Determine if agent has verifiable merit data
  const hasMeritData = !!(
    isVerified ||
    primaryCitation ||
    rating >= 4.8 ||
    totalSales
  );

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

  // Generate JSON-LD schema for SEO
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": professional.name,
    "worksFor": professional.company ? {
      "@type": "Organization",
      "name": professional.company
    } : undefined,
    ...(rating > 0 && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": rating,
        "reviewCount": reviews || 1,
        "bestRating": 5
      }
    }),
    ...(licenseNumber && {
      "hasCredential": {
        "@type": "EducationalOccupationalCredential",
        "credentialId": licenseNumber
      }
    }),
    "additionalProperty": [
      ...(totalSales ? [{
        "@type": "PropertyValue",
        "name": "totalSales",
        "value": totalSales
      }] : []),
      ...(avgSalePrice ? [{
        "@type": "PropertyValue",
        "name": "averageSalePrice",
        "value": avgSalePrice
      }] : []),
      ...(yearsExp ? [{
        "@type": "PropertyValue",
        "name": "yearsExperience",
        "value": yearsExp
      }] : [])
    ].filter(Boolean)
  };

  return (
    <>
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block group h-full"
      >
        <Card className={cn(
          "relative overflow-hidden transition-all duration-300 h-full",
          "hover:shadow-lg hover:-translate-y-0.5",
          "border border-border/50 hover:border-primary/30",
          `bg-gradient-to-br ${getGradientClass(accentColor)}`
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              
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
                {/* Header: Name + Rating */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors text-sm">
                    {professional.name}
                  </h3>
                  {rating > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{rating.toFixed(1)}</span>
                      {reviews > 0 && (
                        <span className="text-xs text-muted-foreground">({reviews})</span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Subheader: Brokerage + License */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  {professional.company && (
                    <p className="text-xs text-muted-foreground truncate">
                      {professional.company}
                    </p>
                  )}
                  {professional.company && licenseNumber && (
                    <span className="text-muted-foreground/50">·</span>
                  )}
                  {licenseNumber && (
                    <span className="text-xs text-muted-foreground/70 truncate">
                      Lic #{licenseNumber.replace(/000$/, '')}
                    </span>
                  )}
                </div>

                {/* Neighborhood Expert Badge */}
                {isPaidExpert && (
                  <Badge className="mt-1.5 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 text-xs">
                    <Award className="h-3 w-3 mr-1" />
                    Neighborhood Expert
                  </Badge>
                )}

                {/* Stats Row */}
                {(hasSalesStats || yearsExp) && (
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30">
                    {yearsExp && yearsExp > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{yearsExp}+ yrs</span>
                      </div>
                    )}
                    {totalSales && totalSales > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Home className="h-3 w-3" />
                        <span>{totalSales.toLocaleString()} sales</span>
                      </div>
                    )}
                    {avgSalePrice && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>{avgSalePrice} avg</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tags Row: Specialties + Price Range */}
                {(specialties.length > 0 || priceRange) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {specialties.slice(0, 2).map((spec, i) => (
                      <Badge 
                        key={i} 
                        variant="secondary" 
                        className="text-[10px] px-1.5 py-0 h-4 bg-muted/50"
                      >
                        {spec}
                      </Badge>
                    ))}
                    {priceRange && (
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary"
                      >
                        {priceRange}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Verified Citation - GEO optimization with external source link */}
                {primaryCitation && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-start gap-1.5">
                      <LinkIcon className="h-3 w-3 text-cactus-green flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-cactus-green font-medium uppercase tracking-wide">
                          {primaryCitation.type === 'community' ? 'Community' : 
                           primaryCitation.type === 'award' ? 'Recognition' : 'Press'}
                        </span>
                        {primaryCitation.url ? (
                          <a
                            href={primaryCitation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="block text-xs text-foreground/80 hover:text-primary hover:underline truncate"
                          >
                            {primaryCitation.text}
                          </a>
                        ) : (
                          <p className="text-xs text-foreground/80 truncate">
                            {primaryCitation.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Merit Verified Badge with hover tooltip */}
                {hasMeritData && (
                  <div className="mt-2 relative group/merit inline-block">
                    <div className="inline-flex items-center gap-1 text-[10px] text-cactus-green cursor-help">
                      <BadgeCheck className="h-3 w-3" />
                      <span className="font-medium">Merit Verified</span>
                    </div>
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-popover border rounded-md shadow-md text-xs text-popover-foreground max-w-[200px] opacity-0 invisible group-hover/merit:opacity-100 group-hover/merit:visible transition-opacity z-50 pointer-events-none">
                      This agent qualified based on performance data and community service, not payment.
                    </div>
                  </div>
                )}
              </div>

              {/* View Profile Arrow */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                <ExternalLink className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </a>
    </>
  );
};
