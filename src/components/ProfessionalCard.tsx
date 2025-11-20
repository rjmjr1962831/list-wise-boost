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
import { ExternalReviewsPreview } from "./ExternalReviewsPreview";
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
  const [extractedYears, setExtractedYears] = useState<number | null>(null);
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
      // ALWAYS extract website and phone from professional_information if available
      const profInfoArray = (professional as any).professional_information;
      let websiteFromProfInfo: string | null = null;
      let phoneFromProfInfo: string | null = null;
      
      if (Array.isArray(profInfoArray) && profInfoArray.length > 0) {
        type InfoEntry = { term?: string; description?: string; lines?: string[]; links?: { text?: string; url?: string }[] };
        const entries = profInfoArray as InfoEntry[];
        const websitesEntry = entries.find(e => e.term === 'Websites');
        websiteFromProfInfo = websitesEntry?.links?.[0]?.url || null;
        
        // Extract phone from any entry whose term mentions phone (e.g. "Phone numbers")
        const phoneEntry = entries.find(e => (e.term || '').toLowerCase().includes('phone'));
        if (phoneEntry?.lines && phoneEntry.lines.length > 0) {
          const rawLine = phoneEntry.lines.find(l => l && l.trim().length > 0) || phoneEntry.lines[0];
          // Many entries look like "Office: 480-555-1234" – strip label before colon
          const parts = rawLine.split(':');
          phoneFromProfInfo = (parts.length > 1 ? parts.slice(1).join(':') : rawLine).trim();
        }
      }
      

      // Primary source: description/get_to_know_me JSON blob from memo23
      const descRaw = (professional as any).description as string | null;
      const getToKnowRaw = (professional as any).get_to_know_me as string | null;
      const profInfoRaw = descRaw || getToKnowRaw || profInfoArray;

      if (!profInfoRaw) {
        return websiteFromProfInfo || phoneFromProfInfo ? { 
          yearsInIndustry: null,
          videoUrl: null,
          specialties: [] as string[],
          websiteUrl: websiteFromProfInfo,
          phone: phoneFromProfInfo,
          description: null
        } : null;
      }

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
            websiteUrl: websiteFromProfInfo,
            phone: phoneFromProfInfo,
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
            websiteUrl: websiteFromProfInfo,
            phone: phoneFromProfInfo,
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
          websiteUrl: websiteFromProfInfo || (parsed as any).websiteUrl || null,
          phone: phoneFromProfInfo,
          description: cleanDescription || trimmed,
        };
      }

      // Handle legacy memo23 JSONB array from professional_information for description
      if (Array.isArray(profInfoArray) && profInfoArray.length > 0) {
        type InfoEntry = { term?: string; description?: string; lines?: string[]; links?: { text?: string; url?: string }[] };
        const entries = profInfoArray as InfoEntry[];

        const findByTerm = (term: string) => entries.find(e => e.term === term);

        const addressEntry = findByTerm('Broker address');
        const memberSinceEntry = findByTerm('Member since');

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
          websiteUrl: websiteFromProfInfo,
          phone: phoneFromProfInfo,
          description: description || null,
        };
      }

      // If we somehow get a non-string (JSONB) without recognisable structure, fall back to simple description field
      const fallback = (professional as any).description as string | null;
      if (!fallback) {
        return websiteFromProfInfo || phoneFromProfInfo ? {
          yearsInIndustry: null,
          videoUrl: null,
          specialties: [] as string[],
          websiteUrl: websiteFromProfInfo,
          phone: phoneFromProfInfo,
          description: null
        } : null;
      }
      return {
        yearsInIndustry: null,
        videoUrl: null,
        specialties: [] as string[],
        websiteUrl: websiteFromProfInfo,
        phone: phoneFromProfInfo,
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
        phone: null,
        description: fallback.trim(),
      };
    }
  })();

  // CRITICAL: Extract years from bio on mount and update database if needed
  useEffect(() => {
    const bioText = parsedProfInfo?.description || (professional as any).description || (professional as any).get_to_know_me;
    console.log(`[${professional.name}] Checking bio for years of experience...`);
    console.log(`[${professional.name}] Bio text:`, bioText?.substring(0, 200));
    
    if (bioText) {
      const bioYears = extractYearsFromBio(bioText);
      console.log(`[${professional.name}] Extracted years from bio:`, bioYears);
      console.log(`[${professional.name}] Current DB years_experience:`, professional.years_experience);
      
      if (bioYears !== null) {
        setExtractedYears(bioYears);
        
        // Update database if extracted value differs from stored value
        if (bioYears !== professional.years_experience && professional.id) {
          console.log(`[${professional.name}] Updating database: ${bioYears} years`);
          supabase
            .from('professionals')
            .update({ years_experience: bioYears })
            .eq('id', professional.id)
            .then(({ error }) => {
              if (error) {
                console.error(`[${professional.name}] Error updating years_experience:`, error);
              } else {
                console.log(`[${professional.name}] Successfully updated years_experience to ${bioYears}`);
              }
            });
        }
      }
    }
  }, [professional.id, professional.name, professional.years_experience, parsedProfInfo?.description]);

  const handleWebsiteClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Use websiteUrl from parsedProfInfo if available
    const websiteSource = parsedProfInfo?.websiteUrl || professional.website || "";

    // Check if we have a valid website
    if (!websiteSource.trim()) {
      const firstName = professional.name.split(" ")[0];
      toast.info(
        `Sorry, it doesn't look like ${firstName} has their own website. Try contacting them.`,
      );
      return;
    }

    const url = (() => {
      let v = websiteSource.trim();
      // Fix common malformed patterns
      if (/^https?:\/\/https?:\/\//i.test(v)) v = v.replace(/^https?:\/\/https?:\/\//i, "https://");
      if (/^https\/:\/\//i.test(v)) v = v.replace(/^https\/:\/\//i, "https://");
      if (/^http\/:\/\//i.test(v)) v = v.replace(/^http\/:\/\//i, "http://");
      if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
      return v;
    })();

    // If the "website" is actually a Zillow URL, treat it as missing personal site
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("zillow.com")) {
        const firstName = professional.name.split(" ")[0];
        toast.info(
          `Sorry, it doesn't look like ${firstName} has their own website. Try contacting them.`,
        );
        return;
      }
    } catch {
      // If URL parsing fails, we'll still attempt navigation after tracking
    }

    trackEvent("agent_profile_click", {
      agent_name: professional.name,
      market,
      destination_url: url,
      agent_type: agentType,
    });

    trackEvent("contact_cta_click", {
      agent_name: professional.name,
      market,
      agent_type: agentType,
    });

    // Proactively check if the external site looks valid before sending the user there
    (async () => {
      try {
        const response = await fetch(url, { method: "HEAD" });

        if (response.ok && response.status < 400) {
          window.open(url, "_blank", "noopener,noreferrer");
        } else {
          const firstName = professional.name.split(" ")[0];
          toast.info(
            `Sorry, it doesn't look like ${firstName} has their own website. Try contacting them.`,
          );
        }
      } catch {
        // If we can't determine the status (CORS/network), fall back to opening the site
        window.open(url, "_blank", "noopener,noreferrer");
      }
    })();
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
          <div className="flex-1 space-y-4">
            {/* Header section with relative positioning for video placement */}
            <div className="relative">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 border-y">
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

                  // Use extracted years if available, otherwise fall back to stored value
                  const yearsExperience = extractedYears ?? parsedProfInfo?.yearsInIndustry ?? professional.years_experience ?? null;

                  const displayStats = { totalSales, yearsExperience } as const;
                  const labels: Record<string, string> = {
                    totalSales: 'Total Sales',
                    yearsExperience: 'Years Experience'
                  };

                  return Object.entries(displayStats).map(([key, value]) => (
                    <div key={key} className="text-center md:text-left">
                      <div className="text-2xl font-bold text-primary">{(value == null || Number(value) <= 0) ? 'NA' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                      <div className="text-xs text-muted-foreground">{labels[key]}</div>
                    </div>
                  ));
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

              {/* Video in upper-right blank space */}
              {(parsedProfInfo?.videoUrl || (professional as any).sidebar_video_url) && (() => {
                const videoUrl = parsedProfInfo?.videoUrl || (professional as any).sidebar_video_url;
                const videoId = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')
                  ? videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop()?.split('?')[0]
                  : null;
                
                return videoId ? (
                  <div className="hidden md:block absolute right-8 top-6">
                    <iframe
                      width="360"
                      height="202"
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title="Agent video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-lg shadow-md"
                    />
                  </div>
                ) : null;
              })()}
            </div>


              {/* Bio Section - Use get_to_know_me from memo23 if available */}
              {(() => {
                // CRITICAL: Bio text MUST preserve line breaks - use whitespace-pre-line
                const bioHtml = (professional as any).get_to_know_me as string | null;
                const fallbackText = parsedProfInfo?.description || professional.description || '';
                
                if (!bioHtml && !fallbackText) return null;
                
                const firstName = professional.name.split(' ')[0];
                
                // Helper to check if text is long enough to need truncation (>600 chars = roughly 8 lines)
                const needsTruncation = (text: string) => text.length > 600;
                
                return (
                  <div itemProp="description" className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">From {firstName}:</h4>
                    {bioHtml ? (() => {
                      const hasHtmlTags = /<p|<br|<div/i.test(bioHtml);
                      const isTooLong = needsTruncation(bioHtml);
                      
                      // CRITICAL: Always preserve line breaks in bios with whitespace-pre-line!
                      if (hasHtmlTags) {
                        return (
                          <>
                            <div
                              className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line prose prose-sm max-w-none ${!showFullDescription && isTooLong ? '' : ''}`}
                              style={!showFullDescription && isTooLong ? { 
                                display: '-webkit-box',
                                WebkitLineClamp: 8,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              } : {}}
                              dangerouslySetInnerHTML={{ __html: bioHtml }}
                            />
                            {isTooLong && (
                              <button
                                onClick={() => setShowFullDescription(!showFullDescription)}
                                className="text-sm text-primary hover:underline mt-1 font-medium block"
                              >
                                {showFullDescription ? 'less' : 'more'}
                              </button>
                            )}
                          </>
                        );
                      }
                      
                      // CRITICAL: Plain text - preserve line breaks with whitespace-pre-line
                      return (
                        <>
                          <div 
                            className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line`}
                            style={!showFullDescription && isTooLong ? { 
                              display: '-webkit-box',
                              WebkitLineClamp: 8,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            } : {}}
                          >
                            {bioHtml}
                          </div>
                          {isTooLong && (
                            <button
                              onClick={() => setShowFullDescription(!showFullDescription)}
                              className="text-sm text-primary hover:underline mt-1 font-medium block"
                            >
                              {showFullDescription ? 'less' : 'more'}
                            </button>
                          )}
                        </>
                      );
                    })() : (() => {
                      const isTooLong = needsTruncation(fallbackText);
                      
                      // CRITICAL: Fallback text - preserve line breaks with whitespace-pre-line
                      return (
                        <>
                          <div 
                            className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line`}
                            style={!showFullDescription && isTooLong ? { 
                              display: '-webkit-box',
                              WebkitLineClamp: 8,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            } : {}}
                          >
                            {fallbackText}
                          </div>
                          {isTooLong && (
                            <button
                              onClick={() => setShowFullDescription(!showFullDescription)}
                              className="text-sm text-primary hover:underline mt-1 font-medium block"
                            >
                              {showFullDescription ? 'less' : 'more'}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Contact Information Section */}
              <div>
                <h4 className="sr-only">Contact Information</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={(() => {
                        const websiteSource = parsedProfInfo?.websiteUrl || professional.website || '';
                        let v = websiteSource.trim();
                        
                        // If no website, return # to prevent navigation
                        if (!v) return '#';
                        
                        // Fix common malformed patterns
                        if (/^https?:\/\/https?:\/\//i.test(v)) v = v.replace(/^https?:\/\/https?:\/\//i, 'https://');
                        if (/^https\/\//i.test(v)) v = v.replace(/^https\/\//i, 'https://');
                        if (/^http\/\//i.test(v)) v = v.replace(/^http\/\//i, 'http://');
                        if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
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
                  {(() => {
                    const phoneDisplay = parsedProfInfo?.phone || professional.phone;
                    if (!phoneDisplay) return null;
                    return (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a 
                          href={`tel:${phoneDisplay}`} 
                          className="text-primary hover:underline contact-agent-button" 
                          itemProp="telephone"
                          onClick={handlePhoneClick}
                        >
                          {phoneDisplay}
                        </a>
                      </div>
                    );
                  })()}
                  {professional.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a 
                        href={`mailto:${professional.email}`} 
                        className="text-primary hover:underline" 
                        itemProp="email"
                      >
                        Email {professional.name.split(' ')[0]}
                      </a>
                    </div>
                  )}
                  {professional.zuid && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a
                        href={`https://www.zillow.com/profile/${professional.zuid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline agent-profile-link"
                        onClick={() =>
                          trackEvent('press_mention_click', {
                            agent_name: professional.name,
                            market: professional.address || '',
                            source: 'Zillow Profile',
                          })
                        }
                      >
                        Zillow Profile
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
                zillowProfileUrl={(professional as any).zillow_profile_url || (professional.zuid ? `https://www.zillow.com/profile/${professional.zuid}` : null)}
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
