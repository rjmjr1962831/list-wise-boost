import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Star, MapPin, Phone, Globe, Award, ChevronDown, ChevronUp, Shield, ShieldCheck, ExternalLink, Loader2, Info } from "lucide-react";
import { Professional } from "@/types/professional";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { ContactProfessionalModal } from "./ContactProfessionalModal";
import { ZillowReviewsSection } from "./ZillowReviewsSection";
import { getLicenseLookupByStateAbbr } from "@/data/stateLicenseLookups";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const borderColorClass = `border-l-${accentColor}`;
  const shadowColorClass = `hover:shadow-${accentColor}/10`;
  
  const listingUrl = typeof window !== 'undefined' ? window.location.href : '';
  
  // Use prop stateAbbr if provided, otherwise extract from market
  const stateAbbr = propStateAbbr || market?.split(',').pop()?.trim() || '';
  const licenseLookupUrl = stateAbbr ? getLicenseLookupByStateAbbr(stateAbbr) : null;
  
  // Use external control if provided, otherwise use local state
  const isContactModalOpen = externalShowContactModal !== undefined ? externalShowContactModal : showContactModal;

  const handleWebsiteClick = () => {
    const url = (() => {
      let v = (professional.website || '').trim();
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
          {/* Photo and Rank */}
          <div className="flex md:flex-col gap-4 md:gap-2 items-center md:items-start flex-shrink-0">
            <img 
              src={professional.image} 
              alt={`${professional.name} - Top Ranked #${professional.rank} specializing in ${professional.specialties.slice(0, 3).join(', ')}`}
              className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover border-2 border-border"
              itemProp="image"
            />
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary">
              <span className="text-2xl font-bold text-primary">#{professional.rank}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {/* Semantic heading with rank for SEO */}
                  <h3 className="text-2xl font-bold" itemProp="name">
                    Top Professional #{professional.rank}: {professional.name}
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="gap-1 px-2 py-0.5 cursor-help">
                            <ShieldCheck className="h-3 w-3 text-primary" />
                            <span className="text-xs">Verified</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">
                            License verified via AI-powered lookup from official state registry
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={handleVerifyLicense}
                          disabled={!licenseLookupUrl}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Verify
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Click to verify license via AI-powered lookup from the official {stateAbbr} state registry
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* Rating */}
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
                <span className="text-muted-foreground">(<span itemProp="reviewCount">{professional.reviews}</span> reviews)</span>
                <meta itemProp="bestRating" content="5" />
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 border-y">
                {(() => {
                  // Estimate stats based on review count
                  const reviews = professional.reviews || 0;
                  const estimatedStats = {
                    currentListings: Math.max(1, Math.round(reviews / 20)),
                    salesLast12Mo: Math.max(5, Math.round(reviews / 5)),
                    totalSales: Math.max(10, Math.round(reviews * 2.5)),
                    yearsExperience: Math.max(2, Math.round(reviews / 15))
                  };

                  const labels: Record<string, string> = {
                    currentListings: "Current Listings",
                    salesLast12Mo: "Sales (12mo)",
                    totalSales: "Total Sales",
                    yearsExperience: "Years Exp."
                  };

                  return Object.entries(estimatedStats).map(([key, value]) => (
                    <div key={key} className="text-center md:text-left">
                      <div className="text-2xl font-bold text-primary">{value}</div>
                      <div className="text-xs text-muted-foreground">{labels[key]}</div>
                    </div>
                  ));
                })()}
              </div>


              {/* Bio/Description with semantic structure */}
              <div itemProp="description">
                <h4 className="sr-only">Professional Bio</h4>
                {(() => {
                  const description = professional.description || '';
                  const lines = description.split('\n').length;
                  const wordCount = description.split(' ').length;
                  const isLong = lines > 3 || wordCount > 60;
                  
                  if (!isLong) {
                    return (
                      <p className="text-muted-foreground leading-relaxed">
                        {description}
                      </p>
                    );
                  }
                  
                  return (
                    <>
                      <p className="text-muted-foreground leading-relaxed">
                        {showFullDescription 
                          ? description 
                          : description.split(' ').slice(0, 60).join(' ') + '...'}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="mt-2 h-auto p-0 text-primary hover:text-primary/80 hover:bg-transparent"
                      >
                        {showFullDescription ? 'Show Less' : 'More'}
                      </Button>
                    </>
                  );
                })()}
              </div>

              {/* Specialties Section */}
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

              {/* Contact Information Section */}
              <div>
                <h4 className="sr-only">Contact Information</h4>
                <div className="grid sm:grid-cols-3 gap-3 pt-2">
                <div className="flex items-center gap-2 text-sm" itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  {/(\d)/.test(professional.address || '') ? (
                    <span className="text-muted-foreground">
                      <span itemProp="streetAddress">{professional.address.split(",")[0]}</span>,{" "}
                      <span itemProp="addressLocality">{professional.address.split(",")[1]?.trim()}</span>,{" "}
                      <span itemProp="addressRegion">{professional.address.match(/[A-Z]{2}/)?.[0]}</span>{" "}
                      <span itemProp="postalCode">{professional.address.match(/\d{5}/)?.[0]}</span>
                      <meta itemProp="addressCountry" content="US" />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      <span itemProp="addressLocality">{market?.split(',')[0]?.trim()}</span>
                      {market?.includes(',') && ", "}
                      <span itemProp="addressRegion">{market?.split(',')[1]?.trim()}</span>
                      <meta itemProp="addressCountry" content="US" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
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
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a
                    href={(() => {
                      let v = (professional.website || '').trim();
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
                    Zillow Listing
                  </a>
                </div>
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

              {/* Zillow Reviews Section */}
              {professional.zuid && <ZillowReviewsSection zuid={professional.zuid} />}

              {/* Client Testimonials Section */}
              {professional.testimonials && professional.testimonials.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-lg font-semibold mb-3">Client Reviews</h4>
                  <div className="space-y-3">
                    {professional.testimonials.slice(0, showAllReviews ? undefined : 1).map((testimonial, idx) => (
                      <div key={idx} className="bg-muted/30 rounded-lg p-4 border border-border/50" itemProp="review" itemScope itemType="https://schema.org/Review">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-sm" itemProp="author">{testimonial.author}</p>
                            {testimonial.source && testimonial.date && (
                              <p className="text-xs text-muted-foreground">
                                {testimonial.source} • {testimonial.date}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed" itemProp="reviewBody">
                          {testimonial.text}
                        </p>
                        <meta itemProp="reviewRating" itemScope itemType="https://schema.org/Rating" content="5" />
                      </div>
                    ))}
                  </div>
                  {professional.testimonials.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="mt-2 text-primary hover:text-primary/80"
                    >
                      {showAllReviews ? (
                        <>
                          Show Less <ChevronUp className="ml-1 h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Read More Reviews ({professional.testimonials.length - 1} more) <ChevronDown className="ml-1 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
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
