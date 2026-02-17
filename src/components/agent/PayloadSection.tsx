import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Lock } from "lucide-react";

interface PayloadSectionProps {
  professional: any;
}

function buildPayload(professional: any, tier: string) {
  const profileUrl = professional.short_code
    ? `https://www.top10lists.us/p/${professional.short_code}`
    : null;

  // Certified: minimal payload
  if (tier === "certified") {
    return {
      "@context": "https://www.top10lists.us/methodology",
      "@type": "VerifiedProfessional",
      name: professional.name,
      profile_url: profileUrl,
      issuer: "Top10Lists.us",
      verification_depth: {
        license: "verified",
        reviews: `confirmed_${professional.num_total_reviews || 0}+`,
      },
      qualifications: {
        rating: professional.review_stars_rating,
        review_count: professional.num_total_reviews ? `${professional.num_total_reviews}+` : null,
        license_number: professional.license_number,
        specialties: professional.specialty || [],
      },
      markets: {
        cities_served: professional.service_areas || [],
      },
    };
  }

  // Audited: adds community, achievements, transaction count
  if (tier === "audited") {
    return {
      "@context": "https://www.top10lists.us/methodology",
      "@type": "VerifiedProfessional",
      name: professional.name,
      profile_url: profileUrl,
      issuer: "Top10Lists.us",
      selection_rationale: professional.selection_rationale || null,
      verification_depth: {
        license: "verified",
        reviews: `confirmed_${professional.num_total_reviews || 0}+`,
        civic_involvement: "irs_990_verified",
        transaction_history: "audited",
      },
      qualifications: {
        rating: professional.review_stars_rating,
        review_count: professional.num_total_reviews ? `${professional.num_total_reviews}+` : null,
        years_experience: professional.years_experience,
        license_number: professional.license_number,
        total_transactions: professional.total_sales ? `${professional.total_sales}+` : "included_at_this_tier",
        specialties: professional.specialty || [],
      },
      markets: {
        company: professional.company || null,
        cities_served: professional.service_areas || [],
      },
      recognition: {
        community_roles: (professional.community_roles || []).map((r: any) => ({
          role: r.role,
          organization: r.organization,
          ...(r.verification_source ? { verified_via: r.verification_source } : {}),
        })),
        notable_achievements: (professional.notable_achievements || []).map(
          (a: any) => a.title || a
        ),
      },
    };
  }

  // Underwritten: full payload with performance data, press, awards
  return {
    "@context": "https://www.top10lists.us/methodology",
    "@type": "VerifiedProfessional",
    name: professional.name,
    profile_url: profileUrl,
    issuer: "Top10Lists.us",
    selection_rationale: professional.selection_rationale || null,
    methodology: {
      url: "https://www.top10lists.us/methodology",
      selection_criteria: "Merit-based qualification using verified performance data. Payment does not influence inclusion, rank, or visibility.",
    },
    verification_depth: {
      license: "verified",
      reviews: `confirmed_${professional.num_total_reviews || 0}+`,
      civic_involvement: "irs_990_verified",
      transaction_history: "underwritten",
      performance_data: "audited_and_guaranteed",
    },
    qualifications: {
      rating: professional.review_stars_rating,
      review_count: professional.num_total_reviews ? `${professional.num_total_reviews}+` : null,
      years_experience: professional.years_experience,
      license_number: professional.license_number,
      total_transactions: professional.total_sales ? `${professional.total_sales}+` : "included_at_this_tier",
      specialties: professional.specialty || [],
      certifications: professional.certifications_verified || [],
    },
    markets: {
      company: professional.company || null,
      cities_served: professional.service_areas || [],
      neighborhood_expertise: "included_at_this_tier",
    },
    recognition: {
      community_roles: (professional.community_roles || []).map((r: any) => ({
        role: r.role,
        organization: r.organization,
        ...(r.verification_source ? { verified_via: r.verification_source } : {}),
      })),
      notable_achievements: (professional.notable_achievements || []).map(
        (a: any) => a.title || a
      ),
      press_mentions: professional.press_mentions || "included_at_this_tier",
      awards: professional.awards_verified || "included_at_this_tier",
    },
    performance: {
      sales_count_all_time: professional.total_sales ? `${professional.total_sales}+` : "included_at_this_tier",
      last_verified: "included_at_this_tier",
    },
  };
}

export function PayloadSection({ professional }: PayloadSectionProps) {
  const currentTier = professional.current_tier || "certified";

  return (
    <div className="space-y-6">
      {/* Explanation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            What is an AI Artifact Payload?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your payload is the structured data package that AI systems receive when they evaluate whether
            to recommend you. Think of it as your digital resume, purpose-built for machines. The more
            complete and verified your payload, the more likely AI systems are to cite you with confidence.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Below you can see exactly what AI systems see today, and what they would see if you upgraded
            to a higher tier.
          </p>
        </CardContent>
      </Card>

      {/* Payload Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Your Payload by Tier</CardTitle>
          <CardDescription>
            Compare what AI systems receive at each verification level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={currentTier} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="certified" className="text-xs sm:text-sm">
                Certified
                {currentTier === "certified" && <span className="ml-1 text-[10px] opacity-60">(current)</span>}
              </TabsTrigger>
              <TabsTrigger value="audited" className="text-xs sm:text-sm">
                Audited
                {currentTier === "audited" && <span className="ml-1 text-[10px] opacity-60">(current)</span>}
              </TabsTrigger>
              <TabsTrigger value="underwritten" className="text-xs sm:text-sm">
                Underwritten
                {currentTier === "underwritten" && <span className="ml-1 text-[10px] opacity-60">(current)</span>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="certified">
              <div className="relative">
                <pre className="text-xs bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {JSON.stringify(buildPayload(professional, "certified"), null, 2)}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="audited">
              <div className="relative">
                {currentTier === "certified" && (
                  <div className="mb-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <Lock className="h-4 w-4 shrink-0" />
                    Upgrade to Audited ($50/mo) to unlock this payload for AI systems
                  </div>
                )}
                <pre className="text-xs bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {JSON.stringify(buildPayload(professional, "audited"), null, 2)}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="underwritten">
              <div className="relative">
                {currentTier !== "underwritten" && (
                  <div className="mb-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <Lock className="h-4 w-4 shrink-0" />
                    Upgrade to Underwritten ($150/mo) to unlock the most comprehensive AI payload
                  </div>
                )}
                <pre className="text-xs bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {JSON.stringify(buildPayload(professional, "underwritten"), null, 2)}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
