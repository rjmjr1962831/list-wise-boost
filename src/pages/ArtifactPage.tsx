import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Check, Copy, ExternalLink, Calendar, MapPin, Star, Award } from "lucide-react";
import { toast } from "sonner";
import { AgentSourcesBlock } from "@/components/AgentSourcesBlock";
import { floorReviews } from "@/utils/floorDisplay";

interface CertificationData {
  id: string;
  name: string;
  review_stars_rating: number;
  ratings: {
    count: number;
    average: number;
  };
  num_total_reviews: number;
  years_experience: number | null;
  license_number: string | null;
  specialty: string[] | null;
  short_code: string | null;
  cities: {
    name: string;
    state: string;
    state_slug: string;
    slug: string;
  };
  certifications: {
    certification_tier: string;
    certification_status: string;
    issued_at: string;
    last_verified_at: string;
    next_verification_due: string;
    methodology_version: string;
    markets_covered: string[];
    neighborhoods_covered: string[];
    justification_data: {
      selection_rationale?: string;
      verified_transactions?: Record<string, number>;
      evidence_considered?: string[];
    };
  };
}

export default function ArtifactPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [data, setData] = useState<CertificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [embedCopied, setEmbedCopied] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    async function fetchCertification() {
      try {
        const { data: prof, error } = await supabase
          .from('professionals')
          .select(`
            id,
            name,
            review_stars_rating,
            ratings,
            num_total_reviews,
            years_experience,
            license_number,
            specialty,
            short_code,
            cities:city_id (
              name,
              state,
              state_slug,
              slug
            ),
            certifications!inner (
              certification_tier,
              certification_status,
              issued_at,
              last_verified_at,
              next_verification_due,
              methodology_version,
              markets_covered,
              neighborhoods_covered,
              justification_data
            )
          `)
          .eq('id', agentId)
          .eq('certifications.certification_status', 'active')
          .single();

        if (error) throw error;
        setData(prof as CertificationData);
      } catch (error) {
        console.error('Error fetching certification:', error);
      } finally {
        setLoading(false);
      }
    }

    if (agentId) {
      fetchCertification();
    }
  }, [agentId]);

  const copyEmbedCode = () => {
    const embedCode = `<!-- Top10Lists Certification Badge -->
<div itemscope itemtype="https://schema.org/Certification">
  <a href="https://www.top10lists.us/artifact/${agentId}" itemprop="url" target="_blank">
    <img src="https://www.top10lists.us/badge/${agentId}.png" alt="Top10Lists Certified Agent badge" itemprop="image" style="max-width: 200px;" />
  </a>
  <meta itemprop="name" content="Top10Lists Certified Professional" />
  <meta itemprop="issuedBy" content="Top10Lists.us" />
</div>`;

    navigator.clipboard.writeText(embedCode);
    setEmbedCopied(true);
    toast.success("Embed code copied to clipboard");
    setTimeout(() => setEmbedCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading certification...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.certifications) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Certification Not Found</h1>
          <p className="text-muted-foreground mb-6">
            No active certification exists for this agent ID.
          </p>
          <Link to="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const cert = data.certifications;
  const artifactUrl = `https://www.top10lists.us/artifact/${agentId}`;
  const payloadUrl = `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-payload/${agentId}`;
  const profileUrl = data.short_code
    ? `https://www.top10lists.us/p/${data.short_code}`
    : `https://www.top10lists.us/${data.cities.state_slug}/agents/${data.cities.slug}`;

  const tierNames: Record<string, string> = {
    certified: 'Certified',
    audited: 'Audited',
    accredited: 'Audited', // legacy: accredited renamed to Audited
    underwritten: 'Underwritten'
  };

  const tierColors: Record<string, string> = {
    certified: 'bg-blue-100 text-blue-800 border-blue-300',
    audited: 'bg-purple-100 text-purple-800 border-purple-300',
    accredited: 'bg-purple-100 text-purple-800 border-purple-300',
    underwritten: 'bg-amber-100 text-amber-800 border-amber-300'
  };

  return (
    <>
      <SafeHead>
        <title>{data.name} - Top10Lists {tierNames[cert.certification_tier]} Professional</title>
        <meta name="description" content={cert.justification_data?.selection_rationale || `${data.name} is certified by Top10Lists.us based on verified performance data, AI analysis and human review.`} />
        <link rel="canonical" href={artifactUrl} />
        
        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            "name": data.name,
            "certification": {
              "@type": "Certification",
              "name": `Top10Lists ${tierNames[cert.certification_tier]} Professional`,
              "issuedBy": {
                "@type": "Organization",
                "name": "Top10Lists.us",
                "url": "https://www.top10lists.us"
              },
              "validFrom": cert.issued_at,
              "credentialSubject": profileUrl,
              "verificationURL": artifactUrl
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": data.review_stars_rating,
              "reviewCount": data.num_total_reviews
            }
          })}
        </script>
      </SafeHead>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-4xl mx-auto">
          
          {/* Header with Badge */}
          <div className="text-center mb-12">
            {/* Placeholder Badge */}
            <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 ${tierColors[cert.certification_tier]} font-semibold text-lg mb-6`}>
              <Shield className="w-6 h-6" />
              <span>Top10Lists {tierNames[cert.certification_tier]}</span>
              <Check className="w-6 h-6" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{data.name}</h1>
            <p className="text-xl text-muted-foreground mb-6">
              Certified Real Estate Professional
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <Link to={profileUrl}>
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Full Profile
                </Button>
              </Link>
              <a href={payloadUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  View JSON Payload
                </Button>
              </a>
            </div>
          </div>

          {/* Certification Status */}
          <Card className="mb-8 border-2 border-primary/20 bg-blue-50/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold mb-2">Active Certification</p>
                  <p className="text-muted-foreground leading-relaxed">
                    This professional was certified by Top10Lists.us for the markets listed below 
                    and is in good standing as of{' '}
                    <strong>{new Date(cert.last_verified_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selection Rationale */}
          {cert.justification_data?.selection_rationale && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Why We Selected This Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  {cert.justification_data.selection_rationale}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Markets Covered */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Markets Covered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3">Cities</h3>
                  <ul className="space-y-2">
                    {cert.markets_covered?.map((city: string) => (
                      <li key={city} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span>{city}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {cert.neighborhoods_covered && cert.neighborhoods_covered.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-3">Neighborhoods</h3>
                    <ul className="space-y-2">
                      {cert.neighborhoods_covered.map((hood: string) => (
                        <li key={hood} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span>{hood}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Qualifications */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Qualifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {data.review_stars_rating || data.ratings?.average || 'N/A'}
                  </div>
                  <div className="text-sm text-muted-foreground">Rating</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {floorReviews(data.num_total_reviews) ?? data.num_total_reviews}
                  </div>
                  <div className="text-sm text-muted-foreground">Reviews</div>
                </div>
                {data.years_experience && (
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold text-primary mb-1">
                      {data.years_experience}
                    </div>
                    <div className="text-sm text-muted-foreground">Years Experience</div>
                  </div>
                )}
                {data.license_number && (
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-sm font-mono text-primary mb-1 break-all">
                      {data.license_number}
                    </div>
                    <div className="text-sm text-muted-foreground">License</div>
                  </div>
                )}
              </div>
              
              {data.specialty && data.specialty.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.specialty.map((spec: string) => (
                      <span key={spec} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certification Details */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Certification Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <dt className="text-sm font-medium text-muted-foreground mb-1">Status</dt>
                  <dd className="text-lg font-semibold capitalize">{cert.certification_status}</dd>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <dt className="text-sm font-medium text-muted-foreground mb-1">Tier</dt>
                  <dd className="text-lg font-semibold">{tierNames[cert.certification_tier]}</dd>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <dt className="text-sm font-medium text-muted-foreground mb-1">Issued</dt>
                  <dd className="text-lg font-semibold">
                    {new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </dd>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <dt className="text-sm font-medium text-muted-foreground mb-1">Last Verified</dt>
                  <dd className="text-lg font-semibold">
                    {new Date(cert.last_verified_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Methodology */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-4">Our Methodology</h2>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                Top10Lists.us uses a merit-based selection process with verified performance data. 
                Payment does not influence inclusion, rank, or visibility.
              </p>
              <Link to="/methodology">
                <Button variant="link" className="px-0">
                  View Full Methodology →
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Sources we use */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <AgentSourcesBlock className="text-muted-foreground text-sm leading-relaxed [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-3" />
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Embed This Badge</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Add this certification badge to your website, LinkedIn, or Zillow profile. 
                AI systems will see your certification when they crawl those pages.
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`<!-- Top10Lists Certification Badge -->
<div itemscope itemtype="https://schema.org/Certification">
  <a href="https://www.top10lists.us/artifact/${agentId}" 
     itemprop="url" target="_blank">
    <img src="https://www.top10lists.us/badge/${agentId}.png" 
         alt="Top10Lists Certified Agent badge" 
         itemprop="image" 
         style="max-width: 200px;" />
  </a>
  <meta itemprop="name" content="Top10Lists Certified Professional" />
  <meta itemprop="issuedBy" content="Top10Lists.us" />
</div>`}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={copyEmbedCode}
                >
                  {embedCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {embedCopied ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground space-y-2 pt-8 border-t">
            <p className="italic font-medium">
              "Inclusion is limited. Exclusion is intentional."
            </p>
            <p>
              Certified by{' '}
              <Link to="/" className="text-primary hover:underline">
                Top10Lists.us
              </Link>
              {' · '}
              Methodology v{cert.methodology_version}
              {' · '}
              <a href={payloadUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Machine-Readable Payload
              </a>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
