import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Award, BadgeCheck, Shield, Zap, Signal, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OverviewSectionProps {
  professional: any;
}

/** State abbreviation to state DRE name for sources. */
function getStateDreName(stateSlug: string | null | undefined): string {
  if (!stateSlug) return "State DRE";
  const s = (stateSlug || "").toUpperCase();
  const map: Record<string, string> = {
    AZ: "AZDRE",
    CA: "CADRE",
    TX: "TREC",
    FL: "FREC",
    NY: "NYS Department of State",
    CO: "Colorado DRE",
    NV: "Nevada Real Estate Division",
  };
  return map[s] || `${s} Department of Real Estate`;
}

/** Format date for display. */
function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/** Expander showing data fields and sources for a tier. Human-facing, not markdown. */
function DataPayloadExpander({
  tier,
  triggerText,
  professional,
}: {
  tier: "certified" | "audited" | "underwritten";
  triggerText: string;
  professional?: any;
}) {
  const [open, setOpen] = useState(false);

  const certifiedSources = [
    "Google",
    "Zillow",
    "MLS",
    getStateDreName(professional?.license_state || professional?.state_slug),
    "National, Regional and Local publications",
  ];

  const certifiedDataRows =
    tier === "certified" && professional
      ? [
          { label: "Brokerage", value: professional.company || professional.business_name || "—" },
          { label: "Date last audited", value: formatDate(professional.last_diligence_check || professional.last_verified_at) },
          {
            label: "Selection rationale",
            value: professional.selection_rationale
              ? (() => {
                  const s = String(professional.selection_rationale);
                  return s.length > 120 ? s.slice(0, 120) + "…" : s;
                })()
              : "—",
          },
          { label: "Lifetime sales", value: professional.total_sales != null ? `>${Number(professional.total_sales).toLocaleString()}` : "—" },
          { label: "Next audit date", value: formatDate(professional.annual_review_date || professional.next_bill_date) },
          {
            label: "Cities served",
            value: Array.isArray(professional.service_areas)
              ? (professional.service_areas as string[]).join(", ") || "—"
              : typeof professional.service_areas === "string"
                ? professional.service_areas
                : "—",
          },
        ]
      : null;

  const content: Record<string, { data: string[]; sources: string[] }> = {
    audited: {
      data: [
        "Everything in Certified, plus:",
        "Selection rationale (why you were chosen)",
        "Years of experience",
        "Total transactions",
        "Company name",
        "Community roles and organizations",
        "Notable achievements",
        "Civic involvement (IRS 990 verified)",
        "Transaction history",
      ],
      sources: [
        "State DRE",
        "Zillow",
        "IRS 990 filings",
        "Verified transaction records",
      ],
    },
    underwritten: {
      data: [
        "Everything in Audited, plus:",
        "Certifications and designations",
        "Neighborhood expertise",
        "Press mentions",
        "Awards",
        "Performance data (sales count, last verified)",
      ],
      sources: [
        "State DRE",
        "Zillow",
        "IRS 990 filings",
        "Verified transaction records",
        "Neighborhood transaction data",
        "Press and awards verification",
      ],
    },
  };

  const isCertifiedWithData = tier === "certified" && certifiedDataRows;
  const dataDisplay = isCertifiedWithData
    ? certifiedDataRows
    : content[tier]?.data.map((item) => ({ label: null, value: item })) ?? [];
  const sourcesDisplay = isCertifiedWithData ? certifiedSources : content[tier]?.sources ?? [];

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
      >
        {triggerText}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="mt-2 p-3 rounded-lg border bg-muted/30 text-sm space-y-2">
          <div>
            <p className="font-medium text-foreground mb-1">Data included</p>
            {isCertifiedWithData ? (
              <dl className="text-muted-foreground space-y-1">
                {certifiedDataRows!.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <dt className="font-medium text-foreground shrink-0">{row.label}:</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                {dataDisplay.map((item, i) => (
                  <li key={i}>{item.value}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Sources</p>
            <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
              {sourcesDisplay.map((src, i) => (
                <li key={i}>{src}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/** Normalize tier for display. Listed/unknown = Certified. */
function normalizeTier(t: string | null): string {
  const t0 = (t || "").toLowerCase();
  if (t0 === "accredited" || t0 === "audited") return "audited";
  if (t0 === "underwritten") return "underwritten";
  return "certified";
}

/** Estimate AICS when no projection exists */
function estimateAICS(base: number | null, current: string, target: string): number | null {
  const lift: Record<string, number> = {
    listed: 4,
    certified: 11,
    audited: 23,
    underwritten: 33,
  };
  const baseScore = base ?? 55;
  const targetLift = lift[target] ?? 11;
  return Math.min(100, Math.round(baseScore - (lift[current] ?? 11) + targetLift));
}

const TIERS = [
  { id: "certified", name: "Certified", price: "Free", icon: BadgeCheck, features: ["Standard Top10Lists badge", "Standard artifact, monthly refresh", "Core credentials published to AI systems"] },
  { id: "audited", name: "Audited", price: "$100/mo", icon: Shield, features: ["Richer data payload", "Bimonthly refresh", "Community involvement, transaction stats"] },
  { id: "underwritten", name: "Underwritten", price: "$150/mo", icon: Zap, features: ["Maximum data richness", "Daily refresh", "Full neighborhood endorsement"] },
] as const;

/** Convert third-person pronouns to second person for "Why We Selected You" context. */
function toSecondPerson(text: string): string {
  return text
    .replace(/\bHis\b/g, "Your")
    .replace(/\bhis\b/g, "your")
    .replace(/\bHim\b/g, "You")
    .replace(/\bhim\b/g, "you")
    .replace(/\bhimself\b/gi, "yourself")
    .replace(/\bHe\b/g, "You")
    .replace(/\bhe\b/g, "you");
}

export function OverviewSection({ professional }: OverviewSectionProps) {
  const navigate = useNavigate();
  const rawTier = professional.current_tier || professional.badge_tier || "certified";
  const currentTier = normalizeTier(rawTier);
  const tierLabel = (rawTier?.toLowerCase() === "listed" ? "certified" : rawTier).replace(/^\w/, (c: string) => c.toUpperCase());
  const baseScore = professional.signal_score ?? professional.certified_projected_signal ?? null;

  const getAICS = (tierId: string): number | null => {
    if (tierId === "certified")
      return professional.certified_projected_signal ?? professional.signal_score ?? estimateAICS(baseScore, currentTier, "certified");
    if (tierId === "audited")
      return professional.audited_projected_signal ?? estimateAICS(baseScore, currentTier, "audited");
    if (tierId === "underwritten") return 98;
    return null;
  };

  const handleUpgrade = (tierId: string) => {
    const token = professional.verification_token || professional.id;
    if (token && (tierId === "audited" || tierId === "underwritten")) {
      navigate(`/funnel/${token}/pricing`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Why We Selected You */}
      {professional.selection_rationale && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Why We Selected You
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{toSecondPerson(professional.selection_rationale)}</p>
          </CardContent>
        </Card>
      )}

      {/* Tier & Signal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Signal className="h-5 w-5 text-primary" />
            Your AI Visibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Tier</p>
              <p className="text-lg font-semibold">{tierLabel}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">AI Confidence Score</p>
              <p className="text-lg font-semibold">
                {professional.signal_score != null ? `${professional.signal_score}/100` : "Pending"}
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Upgrade Your Tier */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Upgrade Your Tier</CardTitle>
          <CardDescription>
            Higher tiers increase your AI Citability Score. Payment never affects inclusion or ranking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {TIERS.map((tier) => {
              const Icon = tier.icon;
              const isCurrent = currentTier === tier.id;
              const aics = getAICS(tier.id);
              const isPaid = tier.id === "audited" || tier.id === "underwritten";

              return (
                <div
                  key={tier.id}
                  className={`rounded-lg border p-4 ${isCurrent ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{tier.name}</span>
                    </div>
                    {isCurrent && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Your tier
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{tier.price}</p>
                  <div className="p-3 rounded-lg bg-muted/50 border mb-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">AI Citability Score</p>
                    <p className="text-xl font-bold">{aics != null ? `${aics}/100` : "Pending"}</p>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex flex-col items-start gap-0">
                        <span className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          {f}
                        </span>
                        {tier.id === "certified" && f === "Core credentials published to AI systems" && (
                          <DataPayloadExpander tier="certified" triggerText="View data and sources" professional={professional} />
                        )}
                        {tier.id === "audited" && f === "Richer data payload" && (
                          <DataPayloadExpander tier="audited" triggerText="View data and sources" />
                        )}
                        {tier.id === "underwritten" && f === "Maximum data richness" && (
                          <DataPayloadExpander tier="underwritten" triggerText="View data and sources" />
                        )}
                      </li>
                    ))}
                  </ul>
                  {isPaid && !isCurrent && (
                    <Button size="sm" className="w-full" onClick={() => handleUpgrade(tier.id)}>
                      Upgrade to {tier.name}
                    </Button>
                  )}
                  {isCurrent && (
                    <p className="text-xs text-muted-foreground text-center">You are on this tier</p>
                  )}
                  {tier.id === "certified" && !isCurrent && (
                    <p className="text-xs text-muted-foreground text-center">Free tier</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground mt-6 text-center">
            No one can guarantee that you will be named when an AI is asked for a recommendation. What we can say is that the higher your score, the more likely you are to be cited by name.
          </p>
        </CardContent>
      </Card>

      {/* How AI Citation Works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            How We Help AI Systems Cite You
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            When someone asks ChatGPT, Claude, Gemini, or Perplexity "Who are the best real estate agents
            in my area?", those AI systems need a trusted, verifiable source to cite. That is where Top10Lists comes in.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We independently verify every agent's credentials through state licensing databases, review
            platforms, IRS 990 filings, and public records. This verification is the same for every
            agent on our platform, regardless of tier. Every number we publish, we stand behind.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We then package your verified data into a structured payload that AI systems can read and
            cite with confidence. Higher tiers publish more of this verified data to AI systems,
            giving them a fuller picture and more reasons to recommend you by name.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
