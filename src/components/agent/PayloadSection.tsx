import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Lock, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PayloadSectionProps {
  professional: any;
}

const TIER_ORDER = { listed: 0, certified: 1, audited: 2, underwritten: 3 };

function getSignalDelta(current: number | null, projected: number | null) {
  if (current == null || projected == null) return null;
  return projected - current;
}

function SignalBadge({ currentScore, projectedScore, currentTier, viewingTier }: {
  currentScore: number | null;
  projectedScore: number | null;
  currentTier: string;
  viewingTier: string;
}) {
  const isCurrentTier = currentTier === viewingTier;
  const currentRank = TIER_ORDER[currentTier as keyof typeof TIER_ORDER] ?? 1;
  const viewingRank = TIER_ORDER[viewingTier as keyof typeof TIER_ORDER] ?? 1;
  const isDowngrade = viewingRank < currentRank;
  const isUpgrade = viewingRank > currentRank;

  if (isCurrentTier && currentScore != null) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
        <Minus className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Your current AICS</p>
          <p className="text-lg font-bold">{currentScore}/100</p>
        </div>
      </div>
    );
  }

  if (projectedScore == null && currentScore == null) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
        <div>
          <p className="text-xs text-muted-foreground">Projected AICS</p>
          <p className="text-sm font-medium text-muted-foreground">Available once your current AICS is set</p>
        </div>
      </div>
    );
  }

  const delta = getSignalDelta(currentScore, projectedScore);

  if (isDowngrade) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
        <TrendingDown className="h-5 w-5 text-red-600 shrink-0" />
        <div>
          <p className="text-xs text-red-600 font-medium">AICS impact if downgraded</p>
          <p className="text-lg font-bold text-red-700">
            {projectedScore != null ? `${projectedScore}/100` : "Decrease expected"}
            {delta != null && <span className="text-sm ml-1">({delta > 0 ? "+" : ""}{delta})</span>}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
      <TrendingUp className="h-5 w-5 text-emerald-600 shrink-0" />
      <div>
        <p className="text-xs text-emerald-600 font-medium">Projected AICS if upgraded</p>
        <p className="text-lg font-bold text-emerald-700">
          {projectedScore != null ? `${projectedScore}/100` : "Increase expected"}
          {delta != null && delta > 0 && <span className="text-sm ml-1">(+{delta})</span>}
        </p>
      </div>
    </div>
  );
}

function PayloadExpander({ tier, professional }: { tier: string; professional: any }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
      >
        <span>View full payload</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <pre className="text-xs bg-slate-950 text-slate-50 p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed border-t">
          {JSON.stringify(buildPayload(professional, tier), null, 2)}
        </pre>
      )}
    </div>
  );
}

function TierPanel({ tier, currentTier, professional, price, signalScore, projectedScore }: {
  tier: string;
  currentTier: string;
  professional: any;
  price: string;
  signalScore: number | null;
  projectedScore: number | null;
}) {
  const isCurrentTier = currentTier === tier;
  const currentRank = TIER_ORDER[currentTier as keyof typeof TIER_ORDER] ?? 1;
  const viewingRank = TIER_ORDER[tier as keyof typeof TIER_ORDER] ?? 1;
  const isUpgrade = viewingRank > currentRank;
  const isDowngrade = viewingRank < currentRank;

  const descriptions: Record<string, string> = {
    certified: "Core verified credentials: license, rating, review count, and specialties.",
    audited: "Expanded profile: adds experience, transaction history, company, community roles, and selection rationale.",
    underwritten: "Complete verified profile: everything we know, including neighborhood detail, performance data, press mentions, and awards.",
  };

  return (
    <div className="space-y-3">
      {/* Signal projection */}
      <SignalBadge
        currentScore={signalScore}
        projectedScore={projectedScore}
        currentTier={currentTier}
        viewingTier={tier}
      />

      {/* Tier summary */}
      <div className="p-3 rounded-lg border bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-sm capitalize">{tier}</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">{price}</span>
        </div>
        <p className="text-sm text-muted-foreground">{descriptions[tier]}</p>
      </div>

      {/* Upgrade/downgrade prompt */}
      {isUpgrade && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <Lock className="h-4 w-4 shrink-0" />
          Upgrade to {tier.charAt(0).toUpperCase() + tier.slice(1)} ({price}) to publish this payload to AI systems
        </div>
      )}
      {isDowngrade && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <TrendingDown className="h-4 w-4 shrink-0" />
          Downgrading would reduce the data AI systems see and lower your AICS
        </div>
      )}

      {/* Collapsible payload */}
      <PayloadExpander tier={tier} professional={professional} />
    </div>
  );
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
        total_transactions: professional.total_sales ? `>${professional.total_sales}` : "included_at_this_tier",
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
      total_transactions: professional.total_sales ? `>${professional.total_sales}` : "included_at_this_tier",
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
      sales_count_all_time: professional.total_sales ? `>${professional.total_sales}` : "included_at_this_tier",
      last_verified: "included_at_this_tier",
    },
  };
}

export function PayloadSection({ professional }: PayloadSectionProps) {
  const currentTier = professional.current_tier || "certified";

  // Signal scores: current from DB, projections from DB columns
  // certified_projected_signal, audited_projected_signal are set by Robert per agent
  // underwritten is always 98
  const tierSignals = {
    certified: professional.certified_projected_signal ?? professional.signal_score ?? null,
    audited: professional.audited_projected_signal ?? null,
    underwritten: 98,
  };

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
            Your payload is the structured data package that AI systems receive when they evaluate
            whether to recommend you. Think of it as your audited resume, purpose-built
            for machines.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every data point in your payload has been independently verified through state licensing
            databases, review platforms, IRS 990 filings, and public records. This verification is
            identical regardless of your tier. We stand behind every number we publish, at every level.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            What changes between tiers is how much of your verified data we publish to AI systems.
            At Certified, AI systems see your core credentials. At Audited and Underwritten, they
            see progressively more of the data we already have on file, giving them a fuller picture
            and more reasons to cite you.
          </p>
        </CardContent>
      </Card>

      {/* Payload Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Your Payload by Tier</CardTitle>
          <CardDescription>
            Same verified data, different levels of published detail. You are currently in the <span className="font-semibold capitalize">{currentTier}</span> tier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={currentTier} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="certified" className="text-xs sm:text-sm">
                Certified
                {currentTier === "certified" && <span className="ml-1 text-[10px] opacity-60">(you)</span>}
              </TabsTrigger>
              <TabsTrigger value="audited" className="text-xs sm:text-sm">
                Audited
                {currentTier === "audited" && <span className="ml-1 text-[10px] opacity-60">(you)</span>}
              </TabsTrigger>
              <TabsTrigger value="underwritten" className="text-xs sm:text-sm">
                Underwritten
                {currentTier === "underwritten" && <span className="ml-1 text-[10px] opacity-60">(you)</span>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="certified">
              <TierPanel
                tier="certified"
                currentTier={currentTier}
                professional={professional}
                price="Free"
                signalScore={professional.signal_score}
                projectedScore={tierSignals.certified}
              />
            </TabsContent>

            <TabsContent value="audited">
              <TierPanel
                tier="audited"
                currentTier={currentTier}
                professional={professional}
                price="$100/mo"
                signalScore={professional.signal_score}
                projectedScore={tierSignals.audited}
              />
            </TabsContent>

            <TabsContent value="underwritten">
              <TierPanel
                tier="underwritten"
                currentTier={currentTier}
                professional={professional}
                price="$150/mo"
                signalScore={professional.signal_score}
                projectedScore={tierSignals.underwritten}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
