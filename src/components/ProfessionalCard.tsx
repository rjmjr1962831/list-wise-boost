import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, CheckCircle2, AlertCircle, Star, MapPin, Phone, Globe, Award, ChevronDown, ChevronUp, Shield, ShieldCheck, ExternalLink, Loader2, Info, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Professional } from "@/types/professional";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { ContactProfessionalModal } from "./ContactProfessionalModal";
import { ZillowReviewsSection } from "./ZillowReviewsSection";
import { ExternalReviewsPreview } from "./ExternalReviewsPreview";
import { ZillowProfileBar } from "./ZillowProfileBar";
import { getLicenseLookupByStateAbbr } from "@/data/stateLicenseLookups";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractYearsFromBio } from "@/utils/bioParser";


interface ProfessionalCardProps {
  professional: Professional;
  accentColor?: "primary" | "sunset-orange" | "terracotta" | "turquoise" | "cactus-green";
  schemaType?: string;
  market?: string;
  stateAbbr?: string;
  agentType?: string;
  citySlug?: string;
  categorySlug?: string;
  onContactClick?: () => void;
  quizCompleted?: boolean;
  showContactModal?: boolean;
}

export const ProfessionalCard = ({ 
  professional, 
  accentColor = "primary",
  schemaType = "Person",
  market = "",
  stateAbbr: propStateAbbr,
  agentType = "",
  citySlug,
  categorySlug,
  onContactClick,
  quizCompleted = true,
  showContactModal: externalShowContactModal
}: ProfessionalCardProps) => {
  const { trackEvent } = useGA4Tracking();
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [license, setLicense] = useState<string | null>(professional.license_number || null);
  const [verifying, setVerifying] = useState(false);
  const isLicenseVerified = !!(professional as any).license_verified_at;
  const borderColorClass = `border-l-${accentColor}`;
  const shadowColorClass = `hover:shadow-${accentColor}/10`;
  
// Zillow stats fetching disabled to improve performance; showing stored values only

  // Background: fetch accurate Zillow stats only if DB values are missing
  const [liveStats, setLiveStats] = useState<any | null>(null);
  const profileUrl = (professional as any).zillow_profile_url || ((professional as any).zuid ? `https://www.zillow.com/profile/${(professional as any).zuid}` : null);
  const needsStats = true;

  // Zillow auto-fetching removed - all scraper functionality has been disconnected

  const listingUrl = typeof window !== 'undefined' ? window.location.href : '';
  
  // Use prop stateAbbr if provided, otherwise extract from market
  const stateAbbr = propStateAbbr || market?.split(',').pop()?.trim() || '';
  const licenseLookupUrl = stateAbbr ? getLicenseLookupByStateAbbr(stateAbbr) : null;
  
  // Use external control if provided, otherwise use local state
  const isContactModalOpen = externalShowContactModal !== undefined ? externalShowContactModal : showContactModal;

  // Parse Adam-style JSON bio once at the top
  const parsedProfInfo = (() => {
    try {
      // Primary source: description/get_to_know_me JSON blob from memo23
      const descRaw = (professional as any).description as string | null;
      const getToKnowRaw = (professional as any).get_to_know_me as string | null;
      const profInfoRaw = descRaw || getToKnowRaw || (professional as any).professional_information;

      if (!profInfoRaw) return null;

      // If it's already plain text (our rewritten bio), just surface it
      if (typeof profInfoRaw === 'string') {
        const trimmed = profInfoRaw.trim();

        // Heuristic: if it doesn't look like JSON, treat as plain bio text
        const looksLikeJson = trimmed.startsWith('{') && trimmed.endsWith('}');
        if (!looksLikeJson) {
          return {
            yearsInIndustry: null,
            videoUrl: null,
            specialties: [] as string[],
            websiteUrl: null,
            description: trimmed,
          };
        }

        // Try to parse memo23-style JSON (newer format)
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== 'object' || !('description' in parsed)) {
          return {
            yearsInIndustry: null,
            videoUrl: null,
            specialties: [] as string[],
            websiteUrl: null,
            description: trimmed,
          };
        }

        // Clean description HTML from memo23 JSON
        let cleanDescription = '';
        if ((parsed as any).description) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = (parsed as any).description;
          cleanDescription = (tempDiv.textContent || tempDiv.innerText || '').trim();
        }

        return {
          yearsInIndustry: (parsed as any).yearsInIndustry ?? null,
          videoUrl: (parsed as any).videoUrl ?? null,
          specialties: Array.isArray((parsed as any).specialties) ? (parsed as any).specialties : [],
          websiteUrl: (parsed as any).websiteUrl ?? null,
          description: cleanDescription || trimmed,
        };
      }

      // Handle legacy memo23 JSONB array from professional_information
      const profInfoArray = (professional as any).professional_information;
      if (Array.isArray(profInfoArray) && profInfoArray.length > 0) {
        type InfoEntry = { term?: string; description?: string; lines?: string[]; links?: { text?: string; url?: string }[] };
        const entries = profInfoArray as InfoEntry[];

        const findByTerm = (term: string) => entries.find(e => e.term === term);

        const addressEntry = findByTerm('Broker address');
        const memberSinceEntry = findByTerm('Member since');
        const websitesEntry = findByTerm('Websites');

        const websiteUrl = websitesEntry?.links?.[0]?.url || null;

        const descriptionParts: string[] = [];
        if (addressEntry?.lines?.length) {
          descriptionParts.push(addressEntry.lines[0]);
        }
        if (memberSinceEntry?.description) {
          descriptionParts.push(`Member since ${memberSinceEntry.description}`);
        }

        const description = descriptionParts.join('. ');

        return {
          yearsInIndustry: null,
          videoUrl: null,
          specialties: [] as string[],
          websiteUrl,
          description: description || null,
        };
      }

      // If we somehow get a non-string (JSONB) without recognisable structure, fall back to simple description field
      const fallback = (professional as any).description as string | null;
      if (!fallback) return null;
      return {
        yearsInIndustry: null,
        videoUrl: null,
        specialties: [] as string[],
        websiteUrl: null,
        description: fallback.trim(),
      };
    } catch (e) {
      console.error('Error parsing memo23-style description JSON:', e);
      const fallback = (professional as any).description as string | null;
      if (!fallback) return null;
      return {
        yearsInIndustry: null,
        videoUrl: null,
        specialties: [] as string[],
        websiteUrl: null,
        description: fallback.trim(),
      };
    }
  })();

  const handleWebsiteClick = () => {
    // Use websiteUrl from parsedProfInfo if available
    const websiteSource = parsedProfInfo?.websiteUrl || professional.website || '';
    
    const url = (() => {
      let v = websiteSource.trim();
      // Fix common malformed patterns
      if (/^https?:\/\/https?:\/\//i.test(v)) v = v.replace(/^https?:\/\/https?:\/\//i, 'https://');
      if (/^https\/\//i.test(v)) v = v.replace(/^https\/\//i, 'https://');
      if (/^http\/\//i.test(v)) v = v.replace(/^http\/\//i, 'http://');
      if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
      return v;
    })();

    trackEvent('agent_profile_click', {
      agent_name: professional.name,
      market,
      destination_url: url,
      agent_type: agentType
    });

    trackEvent('contact_cta_click', {
      agent_name: professional.name,
      market,
      agent_type: agentType
    });
  };

  const handlePhoneClick = () => {
    trackEvent('contact_cta_click', {
      agent_name: professional.name,
      market,
      agent_type: agentType
    });
  };

  const handleVerifyLicense = async () => {
    try {
      setVerifying(true);
      trackEvent('license_verify_click', {
        agent_name: professional.name,
        market,
        state: stateAbbr,
      });

      const { data, error } = await supabase.functions.invoke('lookup-agent-license', {
        body: {
          agentName: professional.name,
          state: stateAbbr,
          licensePortalUrl: licenseLookupUrl || undefined,
        },
      });

      if (error) throw error;
      const found: string | null = data?.licenseNumber || data?.license_number || null;

      if (found) {
        if (professional.id) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({ license_number: found, license_verified_at: new Date().toISOString() })
            .eq('id', professional.id);
          if (updateError) {
            console.error('Failed to save license:', updateError);
          }
        }
        setLicense(found);
        toast.success(`License verified: ${found}`);
        trackEvent('badge_hover', {
          badge_type: 'Verified',
          agent_name: professional.name,
          market
        });
      } else {
        toast.error('No license found.');
      }
    } catch (e: any) {
      console.error('License verification failed', e);
      toast.error('Verification failed. Please try again later.');
    } finally {
      setVerifying(false);
    }
  };
  const handleBadgeHover = () => {
    if (professional.verified) {
      trackEvent('badge_hover', {
        badge_type: 'Verified',
        agent_name: professional.name,
        market
      });
    }
  };

  return (
    <Card 
      className={`border-2 border-l-4 ${borderColorClass} hover:shadow-lg ${shadowColorClass} transition-all`}
      itemScope 
      itemType={`https://schema.org/${schemaType}`}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Photo with specialties below */}
          <div className="flex-shrink-0">
            <img 
              src={professional.image} 
              alt={`${professional.name} - Top professional specializing in ${professional.specialties.slice(0, 3).join(', ')}`}
              className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover border-2 border-border"
              itemProp="image"
            />
            {/* Specialties from professional_information displayed under photo */}
            {parsedProfInfo?.specialties && parsedProfInfo.specialties.length > 0 && (
              <div className="mt-3 space-y-1">
                {parsedProfInfo.specialties.map((specialty, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground text-center">
                    {specialty}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4 relative">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {/* Semantic heading for SEO */}
                  <h3 className="text-2xl font-bold" itemProp="name">
                    {professional.name}
                    {professional.title && <span className="text-muted-foreground">, {professional.title}</span>}
                  </h3>
                  <p className="text-lg text-muted-foreground" itemProp="affiliation">
                    {professional.company}
                  </p>
                </div>
                {professional.verified && (
                  <Badge 
                    variant="secondary" 
                    className="gap-1 agent-badge"
                    onMouseEnter={handleBadgeHover}
                  >
                    <Award className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>

              {/* License Number Section */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>License #:</span>
                </div>
                
                {verifying ? (
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                ) : license ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1.5 px-2.5 py-0.5 text-xs font-medium tracking-wide">
                      {license}
                    </Badge>
                    {isLicenseVerified && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="default" className="gap-1 px-2 py-0.5 cursor-help bg-green-500 hover:bg-green-600">
                            <ShieldCheck className="h-3 w-3" />
                            <span className="text-xs">Verified</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">
                            License verified from official state registry
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleVerifyLicense}
                    disabled={!licenseLookupUrl}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Verify
                  </Button>
                )}
              </div>

              {/* Rating - only show if real data exists */}
              {professional.rating > 0 ? (
                <div className="flex items-center gap-2" itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.floor(professional.rating)
                            ? "fill-primary text-primary"
                            : "text-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold" itemProp="ratingValue">{professional.rating}</span>
                  <span className="text-muted-foreground">(<span itemProp="reviewCount">{professional.reviews.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span> reviews)</span>
                  <meta itemProp="bestRating" content="5" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span className="text-sm">Rating not yet available</span>
                </div>
              )}

              {/* Specialties Section - Areas of Expertise (only if not in professional_information) */}
              {(!parsedProfInfo?.specialties || parsedProfInfo.specialties.length === 0) && professional.specialties.length > 0 && (
                <div>
                  <h4 className="sr-only">Areas of Expertise</h4>
                  <div className="flex flex-wrap gap-2">
                    {professional.specialties.map((specialty, idx) => (
                      <span key={idx} itemProp="knowsAbout">
                        <Badge variant="outline">
                          {specialty}
                        </Badge>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 border-y relative">
              {(() => {
                  const statFromObj = (obj: any, path: string) => {
                    try { const v = path.split('.').reduce((o: any, k: string) => (o ? o[k] : undefined), obj); return v; } catch { return undefined; }
                  };

                  const toNum = (v: any) => {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : null;
                  };

                  const agentStats = (professional as any).agent_sales_stats;

                  const totalSales =
                    toNum(professional.total_sales) ??
                    toNum(statFromObj(agentStats, 'countAllTime')) ??
                    toNum(statFromObj(agentStats, 'countLastYear')) ??
                    toNum(statFromObj(professional, 'stats.totalSales')) ??
                    toNum(statFromObj(professional, 'stats.sold')) ??
                    toNum((liveStats as any)?.totalSales) ??
                    toNum((liveStats as any)?.total_sales) ??
                    toNum((liveStats as any)?.sold);

                  // Calculate years from bio if available, otherwise use stored values
                  const bioYears = extractYearsFromBio(parsedProfInfo?.description || (professional as any).description || (professional as any).get_to_know_me);
                  const yearsExperience = bioYears ?? parsedProfInfo?.yearsInIndustry ?? professional.years_experience ?? null;

                  const displayStats = { totalSales, yearsExperience } as const;
                  const labels: Record<string, string> = {
                    totalSales: 'Total Sales',
                    yearsExperience: 'Years Experience'
                  };

                  return Object.entries(displayStats).map(([key, value]) => (
                    <div key={key} className="text-center md:text-left">
                      <div className="text-2xl font-bold text-primary">{(value == null || Number(value) <= 0) ? 'Not available' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                      <div className="text-xs text-muted-foreground">{labels[key]}</div>
                    </div>
                  ));
                })()}
                
                {/* Video positioned with bottom aligned to stats - use videoUrl from professional_information if available */}
                {(parsedProfInfo?.videoUrl || (professional as any).sidebar_video_url) && (() => {
                  const videoUrl = parsedProfInfo?.videoUrl || (professional as any).sidebar_video_url;
                  const videoId = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')
                    ? videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop()?.split('?')[0]
                    : null;
                  
                  return videoId ? (
                    <div className="absolute right-0 bottom-0 hidden md:block">
                      <iframe
                        width="320"
                        height="180"
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title="Agent video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded-lg border-2 border-border shadow-lg"
                      />
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Data Source Indicator */}
              <div className="flex items-center justify-between gap-2 -mt-2">
                {(professional as any).zillow_data_fetched_at && (
                  <div className="text-xs text-muted-foreground">
                    Updated: {format(new Date((professional as any).zillow_data_fetched_at), 'MMM d, yyyy')}
                  </div>
                )}
                {liveStats && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="gap-1.5 text-xs bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                        <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                        Verified Stats
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        Statistics verified from Zillow
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>


              {/* Bio Section - Use parsed description from professional_information */}
              {(() => {
                const description = parsedProfInfo?.description || professional.description || '';
                
                if (!description) return null;
                
                const paragraphs = description.split('\n\n').filter(p => p.trim());
                const firstTwoParagraphs = paragraphs.slice(0, 2);
                const hasMore = paragraphs.length > 2;
                const firstName = professional.name.split(' ')[0];
                
                return (
                  <div itemProp="description" className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">From {firstName}:</h4>
                    {!hasMore ? (
                      <div className="space-y-3">
                        {paragraphs.map((para, idx) => (
                          <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
                            {para}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <div className="space-y-3">
                          {(showFullDescription ? paragraphs : firstTwoParagraphs).map((para, idx) => (
                            <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
                              {para}
                            </p>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowFullDescription(!showFullDescription)}
                          className="text-sm text-primary hover:underline mt-2 font-medium"
                        >
                          {showFullDescription ? 'less' : 'more'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Contact Information Section */}
              <div>
                <h4 className="sr-only">Contact Information</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-sm">
                  {(parsedProfInfo?.websiteUrl || professional.website || professional.email) && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a
                        href={(() => {
                          let v = (parsedProfInfo?.websiteUrl || professional.website || '').trim();
                          
                          // If no website but email exists, derive from email domain
                          if (!v && professional.email) {
                            const emailDomain = professional.email.split('@')[1];
                            if (emailDomain) {
                              v = `https://${emailDomain}`;
                            }
                          }
                          
                          // Fix common malformed patterns
                          if (v) {
                            if (/^https?:\/\/https?:\/\//i.test(v)) v = v.replace(/^https?:\/\/https?:\/\//i, 'https://');
                            if (/^https\/\//i.test(v)) v = v.replace(/^https\/\//i, 'https://');
                            if (/^http\/\//i.test(v)) v = v.replace(/^http\/\//i, 'http://');
                            if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
                          }
                          return v;
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline agent-profile-link"
                        itemProp="url"
                        onClick={handleWebsiteClick}
                      >
                        Visit {professional.name.split(' ')[0]}'s Website
                      </a>
                    </div>
                  )}
                  {professional.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a 
                        href={`tel:${professional.phone}`} 
                        className="text-primary hover:underline contact-agent-button" 
                        itemProp="telephone"
                        onClick={handlePhoneClick}
                      >
                        {professional.phone}
                      </a>
                    </div>
                  )}
                  {professional.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a 
                        href={`mailto:${professional.email}`} 
                        className="text-primary hover:underline" 
                        itemProp="email"
                      >
                        {professional.email}
                      </a>
                    </div>
                  )}
                  {(professional as any).zuid && (
                    <div className="flex items-center gap-2">
                      <a 
                        href={`https://www.zillow.com/profile/${(professional as any).zuid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                        onClick={() =>
                          trackEvent('press_mention_click', {
                            agent_name: professional.name,
                            market: market || '',
                            source: 'Zillow Profile',
                          })
                        }
                      >
                        Zillow Profile
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>


              {/* Contact Button */}
              <div className="pt-4 border-t">
                <Button 
                  onClick={() => {
                    trackEvent('contact_cta_click', {
                      agent_name: professional.name,
                      market: market,
                      agent_type: agentType
                    });
                    
                    if (onContactClick) {
                      // Use parent's contact handling
                      onContactClick();
                    } else {
                      // Fallback to local modal
                      setShowContactModal(true);
                    }
                  }}
                  className="w-full"
                  variant="default"
                >
                  Contact {professional.name.split(' ')[0]}
                </Button>
              </div>

              {/* External reviews preview (Google/Yelp/Facebook) */}
              <ExternalReviewsPreview 
                agentName={professional.name} 
                company={professional.company} 
                market={market}
                zillowProfileUrl={professional.zuid ? `https://www.zillow.com/profile/${professional.zuid}` : null}
              />

              {/* Zillow Reviews Section */}
              <ZillowReviewsSection 
                zuid={(professional as any).zuid || undefined}
                agentName={professional.name}
                market={market}
                lazyLoad={true}
              />

            </div>
          </div>
        </div>
      </CardContent>

      {!onContactClick && (
        <ContactProfessionalModal
          open={isContactModalOpen}
          onOpenChange={setShowContactModal}
          professionalName={professional.name}
          professionalId={professional.rank.toString()}
          listingUrl={listingUrl}
          citySlug={citySlug}
          categorySlug={categorySlug}
        />
      )}
    </Card>
  );
};
