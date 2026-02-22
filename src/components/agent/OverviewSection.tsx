import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Award, BadgeCheck, Shield, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPayloadExpander } from "@/components/agent/DataPayloadExpander";

interface OverviewSectionProps {
  professional: any;
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
  { id: "audited", name: "Audited", price: "$100/mo", icon: Shield, features: ["Richer data payload", "Every Two Weeks refresh", "Community involvement, transaction stats"] },
  { id: "underwritten", name: "Underwritten", price: "$150/mo", icon: Zap, features: ["Maximum data richness", "Daily refresh", "Full neighborhood endorsement"] },
] as const;

/** Convert third-person pronouns to second person for "Why We Selected You" context. */
function toSecondPerson(text: string): string {
  return text
    .replace(/\bSelected for your\b/g, "You were selected for your")
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

      {/* Our Tiered Product Structure */}
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-lg">Our Tiered Product Structure</CardTitle>
            <CardDescription className="mt-1.5">
              AI agents are directed to trust a recommendation with more verified data and refreshed data of 30 days or less.

              All of our tiers substantially increase your probability of being named by AI. Each tier makes AI more and more likely to cite you by name. None of them guarantee you will be named, but they greatly increase the probability that you will be.

              AI does not consider our model "pay-to-play." There is no penalty when selecting a paid tier.
            </CardDescription>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground mb-1">Ask any AI:</p>
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              &ldquo;Look at top10lists.us. Will an upgrade to their paid tiers increase my likelihood of being cited by AI assistants?&rdquo;
            </p>
          </div>
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
                  <div className="p-3 rounded-lg bg-muted/50 border mb-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">AI Citability Score</p>
                    <p className="text-xl font-bold">{aics != null ? `${aics}/100` : "Pending"}</p>
                  </div>
                  {tier.id === "certified" && (
                    <div className="mb-3">
                      <DataPayloadExpander tier="certified" triggerText="View data and sources" professional={professional} />
                    </div>
                  )}
                  {tier.id === "audited" && (
                    <div className="mb-3">
                      <DataPayloadExpander tier="audited" triggerText="View data and sources" />
                    </div>
                  )}
                  {tier.id === "underwritten" && (
                    <div className="mb-3">
                      <DataPayloadExpander tier="underwritten" triggerText="View data and sources" />
                    </div>
                  )}
                  <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {f}
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
