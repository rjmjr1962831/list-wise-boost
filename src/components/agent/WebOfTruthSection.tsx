import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const BASE = "https://www.top10lists.us";

interface Platform {
  label: string;
  present: boolean;
  url?: string;
  howToPlace: string;
}

interface WebOfTruthSectionProps {
  professional: any;
}

export function WebOfTruthSection({ professional }: WebOfTruthSectionProps) {
  const navigate = useNavigate();
  const hasWebOfTruth = !!professional.profile_link;
  const artifactToken = professional.verification_token || professional.id;
  const artifactUrl = `${BASE}/artifact/${artifactToken}`;
  const badgeId = professional.short_code || professional.id;
  const badgeSvgUrl = `${BASE}/api/badge/${badgeId}.svg`;

  const platforms: Platform[] = [
    {
      label: "Personal Website",
      present: !!professional.website,
      url: professional.website || undefined,
      howToPlace: "Paste the HTML beacon in your site footer or about page",
    },
    {
      label: "Zillow",
      present: !!professional.zillow_profile_url,
      url: professional.zillow_profile_url || undefined,
      howToPlace: "Add your artifact URL to your Zillow bio/about section",
    },
    {
      label: "Realtor.com",
      present: !!professional.social_realtor_com,
      url: professional.social_realtor_com || undefined,
      howToPlace: "Add your artifact URL to your Realtor.com about section",
    },
    {
      label: "Google Business",
      present: !!professional.google_place_id || !!professional.google_business_name,
      url: professional.google_maps_url || undefined,
      howToPlace: "Add your artifact URL to your Google Business website field",
    },
    {
      label: "LinkedIn",
      present: !!professional.social_linkedin,
      url: professional.social_linkedin || undefined,
      howToPlace: "Add to Licenses & Certifications or your bio",
    },
    {
      label: "Facebook",
      present: !!professional.social_facebook,
      url: professional.social_facebook || undefined,
      howToPlace: "Add your artifact URL to your page bio",
    },
    {
      label: "Instagram",
      present: !!professional.social_instagram,
      url: professional.social_instagram || undefined,
      howToPlace: "Add your artifact URL as your bio link",
    },
    {
      label: "Email Signature",
      present: false, // can't detect this
      howToPlace: "Paste the HTML beacon into your email signature",
    },
  ];

  const activePlatforms = platforms.filter((p) => p.present);
  const missingPlatforms = platforms.filter((p) => !p.present);

  return (
    <div className="space-y-6">
      {hasWebOfTruth ? (
        <Card className="border-green-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Your Web of Truth is active
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your verified artifact is live and citable by AI systems. Every platform where you place your beacon strengthens the trust network.
            </p>

            {/* Where it's active */}
            {activePlatforms.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Active on:</p>
                <div className="space-y-1.5">
                  {activePlatforms.map((p) => (
                    <div key={p.label} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <span>{p.label}</span>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Where to add it */}
            {missingPlatforms.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Strengthen your Web of Truth — add it to:</p>
                <div className="space-y-2">
                  {missingPlatforms.map((p) => (
                    <div key={p.label} className="flex items-start gap-2 text-sm">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">{p.label}</span>
                        <p className="text-xs text-muted-foreground">{p.howToPlace}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/badge-instructions?token=${artifactToken}`)}
              >
                View full instructions &amp; embed code
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              Your Web of Truth is not active
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your Web of Truth beacon creates a verified cross-reference chain across the internet. Every platform where you place it gives AI one more reason to trust — and name — you.
            </p>

            {/* Where they should place it */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Place your beacon on:</p>
              <div className="space-y-2">
                {platforms.map((p) => (
                  <div key={p.label} className="flex items-start gap-2 text-sm">
                    {p.present ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className={p.present ? "font-medium" : "font-medium"}>{p.label}</span>
                      {!p.present && <p className="text-xs text-muted-foreground">{p.howToPlace}</p>}
                      {p.present && p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-1">
                          <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => navigate(`/badge-instructions?token=${artifactToken}`)}
            >
              Enable Your Web of Truth
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
