import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Award, BadgeCheck, Shield, Zap, Sparkles, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  { id: "audited", name: "Audited", price: "$300/mo", icon: Shield, features: ["Richer data payload", "Monthly refresh", "Community involvement, transaction stats"] },
  { id: "underwritten", name: "Underwritten", price: "$500/mo", icon: Zap, features: ["Maximum data richness", "Daily refresh", "Full neighborhood endorsement"] },
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
  const [isAnnual, setIsAnnual] = useState(false);
  const rawTier = professional.current_tier || professional.badge_tier || "certified";
  const currentTier = normalizeTier(rawTier);
  const baseScore = professional.signal_score ?? professional.certified_projected_signal ?? null;

  const getAICS = (tierId: string): number | null => {
    if (tierId === "listed") return 10;
    if (tierId === "certified")
      return professional.certified_projected_signal ?? professional.signal_score ?? 25;
    if (tierId === "audited")
      return professional.audited_projected_signal ?? 65;
    if (tierId === "underwritten") return 95;
    return null;
  };

  const getPrice = (tierId: string) => {
    if (tierId === "certified") return "Free";
    if (tierId === "audited") return isAnnual ? "$3,000/year" : "$300/mo";
    if (tierId === "underwritten") return isAnnual ? "$5,000/year" : "$500/mo";
    return "—";
  };

  const handleUpgrade = (tierId: string) => {
    const token = professional.verification_token || professional.id;
    if (token && (tierId === "audited" || tierId === "underwritten")) {
      navigate(`/funnel/${token}/pricing`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Our Tiered Product Structure */}
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-lg">Our Tiered Product Structure</CardTitle>
  
          </div>
          {/* AICS + Web of Truth™ + Ways to Improve */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* AI Citability Score */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your AI Citability Score</p>
              <p className="text-3xl font-bold text-foreground">
                {getAICS(currentTier) != null ? `${getAICS(currentTier)}/100` : "Pending"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Based on your current tier and verified data</p>
            </div>

            {/* Web of Truth™ */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your Web of Truth<sup>™</sup></p>
              {professional.profile_link ? (
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  <span className="text-sm font-semibold text-green-700">Enabled</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold text-muted-foreground">Disabled</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">Your public trust artifact that AI systems can cite</p>
            </div>
          </div>

          {/* Ways to improve */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Ways to improve your score
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                Upgrade your tier
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                {professional.profile_link ? "Your Web of Truth™ is active" : (
                  <span>Enable your Web of Truth™ <span className="text-xs text-green-600 font-medium">(free)</span></span>
                )}
              </li>
            </ul>
          </div>

          {/* Ask any AI challenge */}
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
                  className={`relative rounded-lg border p-4 ${tier.id === "audited" ? "pt-6" : ""} ${isCurrent ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                >
                  {tier.id === "audited" && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  {isCurrent && (
                    <p className="text-sm font-semibold text-primary mb-2">You are on this tier</p>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{tier.name}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-3">{getPrice(tier.id)}</p>
                  <div className={`flex items-center justify-center gap-2 mb-3 ${tier.id === "certified" ? "opacity-50 pointer-events-none" : ""}`} onClick={(e) => e.stopPropagation()}>
                    <Label htmlFor={`overview-billing-${tier.id}`} className="text-xs">Monthly</Label>
                    <Switch id={`overview-billing-${tier.id}`} checked={isAnnual} onCheckedChange={setIsAnnual} disabled={tier.id === "certified"} />
                    <Label htmlFor={`overview-billing-${tier.id}`} className="text-xs">Annual (2 mo free)</Label>
                  </div>
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
