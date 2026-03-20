import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Target, AlertTriangle, CheckCircle2, XCircle, TrendingUp,
  Globe, Search, Users, FileCode, Quote, ChevronDown, ChevronUp,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GeoAuditData {
  score_listed: number;
  score_certified: number;
  score_audited: number;
  score_underwritten: number;
  pillar_identity: number;
  pillar_authority: number;
  pillar_social: number;
  pillar_technical: number;
  pillar_citability: number;
  review_count: number;
  review_rating: number;
  platforms_found: string[];
  exa_source_count: number;
  gap_no_linkedin: boolean;
  gap_no_schema: boolean;
  gap_no_realtor: boolean;
  gap_no_homelight: boolean;
  gap_no_press: boolean;
  gap_no_personal_site: boolean;
  gap_no_google_business: boolean;
  gap_no_homes_com: boolean;
  gap_stale_reviews: boolean;
  has_linkedin: boolean;
  has_realtor: boolean;
  has_homelight: boolean;
  has_facebook: boolean;
  has_personal_site: boolean;
  has_zillow: boolean;
  has_schema_markup: boolean;
  has_google_business: boolean;
  has_homes_com: boolean;
  recency_label: string;
  most_recent_signal: string | null;
  full_name: string;
  city: string | null;
  state: string | null;
  website: string | null;
}

interface AIMaxPlanProps {
  professional: any;
}

function bandFromScore(score: number): { label: string; color: string; bg: string } {
  if (score <= 35) return { label: "Invisible", color: "text-red-500", bg: "bg-red-500" };
  if (score <= 65) return { label: "Fragmented", color: "text-orange-500", bg: "bg-orange-500" };
  if (score <= 85) return { label: "Recognized", color: "text-blue-500", bg: "bg-blue-500" };
  return { label: "High Fidelity", color: "text-green-500", bg: "bg-green-500" };
}

function PillarBar({ label, score, maxScore, icon: Icon, description }: {
  label: string; score: number; maxScore: number; icon: any; description: string
}) {
  const pct = Math.max(0, Math.min(100, (score / maxScore) * 100));
  const barColor = score < 0 ? "bg-red-400" : pct < 30 ? "bg-red-400" : pct < 60 ? "bg-orange-400" : pct < 80 ? "bg-blue-400" : "bg-green-400";
  const textColor = score < 0 ? "text-red-500" : pct < 30 ? "text-red-500" : pct < 60 ? "text-orange-500" : pct < 80 ? "text-blue-500" : "text-green-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${textColor}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${textColor}`}>
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(0, pct)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function GapItem({ exists, label, impact, description }: {
  exists: boolean; label: string; impact: "critical" | "high" | "medium"; description: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const impactColors = {
    critical: "text-red-500 bg-red-50 dark:bg-red-950/30",
    high: "text-orange-500 bg-orange-50 dark:bg-orange-950/30",
    medium: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30",
  };
  const impactLabels = { critical: "Critical", high: "High Impact", medium: "Moderate" };

  if (exists) return null; // Don't show items the agent already has

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-sm font-medium text-left">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${impactColors[impact]}`}>
            {impactLabels[impact]}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      )}
    </div>
  );
}

function PresenceItem({ exists, label, url }: { exists: boolean; label: string; url?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        {exists ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
        )}
        <span className="text-sm">{label}</span>
      </div>
      {exists && url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
          View <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

export function AIMaxPlan({ professional }: AIMaxPlanProps) {
  const [data, setData] = useState<GeoAuditData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!professional?.id) return;
    supabase
      .rpc("run_sql" as any, {
        query: `SELECT score_listed, score_certified, score_audited, score_underwritten, pillar_identity, pillar_authority, pillar_social, pillar_technical, pillar_citability, review_count, review_rating, platforms_found, exa_source_count, gap_no_linkedin, gap_no_schema, gap_no_realtor, gap_no_homelight, gap_no_press, gap_no_personal_site, gap_no_google_business, gap_no_homes_com, gap_stale_reviews, has_linkedin, has_realtor, has_homelight, has_facebook, has_personal_site, has_zillow, has_schema_markup, has_google_business, has_homes_com, recency_label, most_recent_signal, full_name, city, state, website FROM geo_audit_results WHERE agent_id = '${professional.id}' LIMIT 1`
      })
      .then(({ data: rows }: any) => {
        if (rows && rows.length > 0) setData(rows[0]);
        setLoading(false);
      });
  }, [professional?.id]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Loading your AI Maximization Plan...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    const handleRequestAnalysis = async () => {
      const { error } = await supabase.from("crm_tasks").insert({
        professional_id: professional.id,
        task_type: "aifs_analysis",
        title: `AIFS analysis requested: ${professional.name ?? "Agent"}`,
        description: "Agent requested AI Footprint Score analysis from their dashboard.",
        status: "pending",
        priority: "high",
      });
      if (error) {
        const { toast } = await import("sonner");
        toast.error("Request failed. Please try again.");
      } else {
        const { toast } = await import("sonner");
        toast.success("Analysis requested! We'll process your profile shortly.");
      }
    };

    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">AI Footprint analysis is pending for your profile.</p>
          <button
            onClick={handleRequestAnalysis}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            <Search className="h-4 w-4" />
            Request My Analysis
          </button>
        </CardContent>
      </Card>
    );
  }

  const band = bandFromScore(data.score_listed);
  // Map score (0-100) to bar position accounting for unequal flex segments
  // Bar segments: Invisible 0-35 (flex-[35]), Fragmented 36-65 (flex-[30]), Recognized 66-85 (flex-[20]), High Fidelity 86-100 (flex-[15])
  const scoreToBarPct = (score: number): number => {
    if (score <= 35) return (score / 35) * 35;
    if (score <= 65) return 35 + ((score - 35) / 30) * 30;
    if (score <= 85) return 65 + ((score - 65) / 20) * 20;
    return 85 + ((score - 85) / 15) * 15;
  };
  const markerPct = Math.min(100, scoreToBarPct(data.score_listed));
  const gapCount = [
    data.gap_no_google_business, data.gap_no_schema, data.gap_no_homes_com,
    data.gap_stale_reviews, data.gap_no_homelight, data.gap_no_personal_site,
    data.gap_no_linkedin, data.gap_no_realtor, data.gap_no_press,
  ].filter(Boolean).length;

  // Derive presence from both AIFS analysis flags AND actual professional fields
  const hasZillow = data.has_zillow || !!professional.zillow_profile_url;
  const hasLinkedin = data.has_linkedin || !!professional.social_linkedin;
  const hasRealtor = data.has_realtor || !!professional.social_realtor_com;
  const hasGoogle = data.has_google_business || !!professional.google_place_id || !!professional.google_business_name;
  const hasPersonalSite = data.has_personal_site || !!professional.website || !!professional.google_website;
  const hasHomelight = data.has_homelight || !!professional.social_homelight;
  const hasHomesCom = data.has_homes_com || !!professional.social_homes_com;
  const hasFacebook = data.has_facebook || !!professional.social_facebook;
  const hasInstagram = !!professional.social_instagram;
  const hasTiktok = !!professional.social_tiktok;
  const hasPress = !data.gap_no_press || (Array.isArray(professional.press_mentions) && professional.press_mentions.length > 0);
  const hasSchema = data.has_schema_markup;

  const derivedPlatformCount = [
    true, // Top10Lists always
    hasZillow, hasLinkedin, hasRealtor, hasGoogle, hasPersonalSite,
    hasHomelight, hasHomesCom, hasFacebook, hasInstagram, hasTiktok, hasPress, hasSchema,
  ].filter(Boolean).length;
  const platformCount = derivedPlatformCount;
  const agentName = data.full_name || professional.name || "Agent";
  const firstName = agentName.split(" ")[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">AI Footprint Maximization Plan</p>
          <h2 className="text-2xl font-bold mb-1">{agentName}</h2>
          <p className="text-sm text-slate-300">
            {data.city && data.state ? `${data.city}, ${data.state}` : professional.business_city ? `${professional.business_city}` : ""}
            {data.review_count ? ` -- ${data.review_count} reviews` : ""}
            {professional.years_experience ? ` -- ${professional.years_experience} years experience` : ""}
          </p>

          {/* Score hero */}
          <div className="mt-6 flex items-end gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Your AIFS</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-6xl font-black tabular-nums ${band.color}`}>{data.score_listed}</span>
                <span className="text-xl text-slate-400">/ 100</span>
              </div>
              <span className={`text-sm font-semibold ${band.color}`}>{band.label}</span>
            </div>
            <div className="flex-1 mb-3">
              {/* Spectrum bar */}
              <div className="relative">
                <div className="h-3 rounded-full overflow-hidden flex">
                  <div className="flex-[35] bg-red-500/60" />
                  <div className="flex-[30] bg-orange-500/60" />
                  <div className="flex-[20] bg-blue-500/60" />
                  <div className="flex-[15] bg-green-500/60" />
                </div>
                <div
                  className={`absolute -top-1 -translate-x-1/2 w-5 h-5 rounded-full border-3 border-white shadow-lg ${band.bg}`}
                  style={{ left: `${markerPct}%` }}
                />
                {/* Band labels */}
                <div className="flex mt-1.5">
                  <span className="flex-[35] text-[9px] text-slate-500">Invisible</span>
                  <span className="flex-[30] text-[9px] text-slate-500">Fragmented</span>
                  <span className="flex-[20] text-[9px] text-slate-500">Recognized</span>
                  <span className="flex-[15] text-[9px] text-slate-500">High Fidelity</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            You have been independently selected for Top10Lists.us based on our Merit Gate: 4.5+ stars, 10+ verified reviews in the past 24 months, and 5+ years of experience. Fewer than 1% of licensed agents in our covered markets meet this standard.
            <strong> You earned your place here.</strong> This plan shows you what to do to make sure AI systems know it.
          </p>
        </CardContent>
      </Card>

      {/* Pillar Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Your Five Pillars
          </CardTitle>
          <p className="text-xs text-muted-foreground">How AI systems evaluate your discoverability across five dimensions</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <PillarBar
            label="Authority"
            score={data.pillar_authority}
            maxScore={25}
            icon={Users}
            description="Third-party endorsements, brokerage affiliation, industry recognition, press mentions"
          />
          <PillarBar
            label="Social Proof"
            score={data.pillar_social}
            maxScore={25}
            icon={Users}
            description="Review volume, review quality, review recency, platform diversity"
          />
          <PillarBar
            label="Identity"
            score={data.pillar_identity}
            maxScore={25}
            icon={Globe}
            description="Name consistency across the web, license verification, entity disambiguation"
          />
          <PillarBar
            label="Citability"
            score={data.pillar_citability}
            maxScore={25}
            icon={Quote}
            description="Whether AI systems can extract and cite your credentials in a recommendation"
          />
          <PillarBar
            label="Technical"
            score={data.pillar_technical}
            maxScore={25}
            icon={FileCode}
            description="Schema markup, website crawlability, machine-readable structured data"
          />
        </CardContent>
      </Card>

      {/* Where You're Found */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Where AI Systems Find You
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {platformCount > 0
              ? `We found you on ${platformCount} platform${platformCount !== 1 ? "s" : ""} across the open web`
              : "We were unable to find you on any platforms beyond Top10Lists.us"}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-0 divide-y">
            <PresenceItem exists={true} label="Top10Lists.us" url={`https://www.top10lists.us/${professional.state_slug}/agents/${professional.canonical_slug}`} />
            <PresenceItem exists={hasZillow} label="Zillow" url={professional.zillow_profile_url || undefined} />
            <PresenceItem exists={hasLinkedin} label="LinkedIn" url={professional.social_linkedin || undefined} />
            <PresenceItem exists={hasRealtor} label="Realtor.com" url={professional.social_realtor_com || undefined} />
            <PresenceItem exists={hasGoogle} label="Google Business Profile" url={professional.google_maps_url || undefined} />
            <PresenceItem exists={hasPersonalSite} label="Personal Website" url={professional.website || professional.google_website || data.website || undefined} />
            <PresenceItem exists={hasHomelight} label="HomeLight" url={professional.social_homelight || undefined} />
            <PresenceItem exists={hasHomesCom} label="Homes.com" url={professional.social_homes_com || undefined} />
            <PresenceItem exists={hasFacebook} label="Facebook" url={professional.social_facebook || undefined} />
            <PresenceItem exists={hasInstagram} label="Instagram" url={professional.social_instagram || undefined} />
            <PresenceItem exists={hasTiktok} label="TikTok" url={professional.social_tiktok || undefined} />
            <PresenceItem exists={hasPress} label="Press Mentions" url={Array.isArray(professional.press_mentions) && professional.press_mentions.length > 0 ? professional.press_mentions[0]?.url : undefined} />
            <PresenceItem exists={hasSchema} label="Schema Markup (any site)" />
          </div>

          {data.most_recent_signal && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">Most recent signal detected:</span> {data.most_recent_signal}
              </p>
              {data.gap_stale_reviews && (
                <p className="text-xs text-orange-500 mt-1">
                  AI systems weight recency heavily. Reviews older than a few months are treated as aging signals.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* What to Fix */}
      {gapCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {gapCount} Gap{gapCount !== 1 ? "s" : ""} Holding You Back
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Each gap is something you can address on your own, at no cost. Tap any item for details.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <GapItem
              exists={data.has_google_business}
              label="Claim a Google Business Profile"
              impact="critical"
              description="Google Business Profile is the single highest-leverage action for local AI visibility. Google Gemini, integrated into Google Search, Android, and Google Maps, draws directly from GBP data. Meta AI and ChatGPT also reference Google Business data as a corroborating source. A complete GBP with your license number, service areas, business hours, photos, and review responses creates a structured entity that AI systems can parse immediately."
            />
            <GapItem
              exists={data.has_schema_markup}
              label="Add Schema Markup to Your Website"
              impact="critical"
              description="Schema markup is the structured data language that tells AI systems exactly who you are, what you do, where you work, and what credentials you hold. It is the difference between AI reading a webpage and AI understanding a webpage. Without RealEstateAgent, LocalBusiness, and AggregateRating schema types embedded in your site's code, your website is invisible to AI at a machine level. This is the primary reason most agents have a negative Technical pillar score."
            />
            <GapItem
              exists={!data.gap_stale_reviews}
              label="Generate Fresh Reviews"
              impact="high"
              description="AI systems treat review recency as a proxy for 'is this agent currently active and performing well?' Reviews from more than a few months ago count for significantly less in AI recommendations. An agent with 20 recent reviews will often outrank an agent with 200 older reviews. Fresh reviews on Zillow and Google create signals that AI systems pick up on their next crawl cycle. Volume matters, but recency matters more."
            />
            <GapItem
              exists={data.has_realtor}
              label="Claim Your Realtor.com Profile"
              impact="high"
              description="Realtor.com is one of the most-cited sources when AI systems compile agent recommendations. AI systems use cross-platform consistency as a trust signal -- when the same agent appears on Zillow, Realtor.com, HomeLight, and Homes.com with consistent name, license number, and credentials, AI systems gain confidence that this is a real, active, verified professional."
            />
            <GapItem
              exists={data.has_homelight}
              label="Claim Your HomeLight Profile"
              impact="high"
              description="HomeLight is increasingly referenced by AI systems as an independent performance validation source. It is an agent evaluation platform that AI systems use to corroborate your transaction data and client outcomes. Claiming your profile adds an independent verification signal that strengthens your Citability pillar."
            />
            <GapItem
              exists={data.has_homes_com}
              label="Claim Your Homes.com Profile"
              impact="medium"
              description="Homes.com is building aggressive AI integrations and growing its role as a data source for AI agent recommendations. Agents without a claimed profile are invisible to that pipeline. Claiming and completing your profile creates another corroborating data point that AI systems can use to verify your identity and credentials."
            />
            <GapItem
              exists={data.has_personal_site}
              label="Build or Upgrade Your Personal Website"
              impact="medium"
              description="A personal website is your owned real estate on the internet -- the one place where you control the narrative entirely. AI systems use personal websites as primary entity sources, especially when they contain structured data (schema markup). A website without schema markup is like a billboard only humans can read. With proper schema, your Technical pillar can jump by 8-10 points."
            />
            <GapItem
              exists={data.has_linkedin}
              label="Create or Link Your LinkedIn Profile"
              impact="medium"
              description="LinkedIn is a high-authority professional identity source. AI systems use LinkedIn profiles to verify professional identity, employment history, and credentials. When your LinkedIn profile is connected to your real estate practice and contains consistent information (name, license, brokerage), it creates a strong identity corroboration signal."
            />
            <GapItem
              exists={!data.gap_no_press}
              label="Generate a Press Mention"
              impact="medium"
              description="Press mentions are disproportionately weighted by AI systems because they represent third-party editorial validation. This does not need to be a national publication. A local business journal feature, a community board recognition, a charity event sponsorship mention, or even an interview in a neighborhood newsletter -- any independently published mention of your name in connection with real estate creates an authority signal that is very difficult for competitors to replicate."
            />
          </CardContent>
        </Card>
      )}

      {/* Score Projections */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            What Your Score Could Look Like
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const rawTier = (professional.current_tier || professional.badge_tier || "certified").toLowerCase();
            const agentTier = rawTier === "accredited" ? "audited" : rawTier;
            const tierOrder = ["certified", "audited", "underwritten"];
            const agentTierIndex = tierOrder.indexOf(agentTier);
            const tiers = [
              {
                key: "certified",
                label: "Certified",
                score: data.score_certified,
                sublabel: "Quarterly refresh",
                aiMeaning: "AI can verify your credentials but has limited data. It may mention you but without strong conviction.",
              },
              {
                key: "audited",
                label: "Audited",
                score: data.score_audited,
                sublabel: "Monthly refresh",
                aiMeaning: "AI sees expanded evidence from 10+ sources refreshed monthly. More likely to recommend you with detail and confidence.",
              },
              {
                key: "underwritten",
                label: "Underwritten",
                score: data.score_underwritten,
                sublabel: "Daily refresh",
                aiMeaning: "AI sees your complete verified profile refreshed daily. Highest probability of being named first with full conviction.",
              },
            ];
            const token = professional.verification_token || professional.id;
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {tiers.map((tier) => {
                    const tb = bandFromScore(tier.score);
                    const tierIndex = tierOrder.indexOf(tier.key);
                    const isActive = tierIndex <= agentTierIndex;
                    const isCurrent = tier.key === agentTier;
                    return (
                      <div key={tier.key} className={`rounded-lg border p-4 text-center ${isCurrent ? "border-primary/40 bg-primary/5" : ""}`}>
                        <p className="text-xs text-muted-foreground mb-1">{tier.label}{isCurrent ? " (Current)" : ""}</p>
                        <p className={`text-3xl font-black tabular-nums ${tb.color}`}>{tier.score}</p>
                        <p className={`text-xs font-semibold ${tb.color}`}>{tb.label}</p>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{tier.aiMeaning}</p>
                        {isActive ? (
                          <span className="inline-block mt-3 text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">Active</span>
                        ) : (
                          <a href={`/funnel/${token}/pricing`} className="inline-block mt-3 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1 rounded-full transition-colors">
                            Upgrade
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-4 text-center leading-relaxed">
                  The actions above are things you can do yourself, at no cost. Tier upgrades add verification depth,
                  refresh frequency, and expanded evidence sourcing — but the foundation is your own web presence.
                </p>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center space-y-2 pb-4">
        <p className="text-xs text-muted-foreground">
          This plan was generated using Top10Lists.us proprietary AIFS scoring, which evaluates how AI systems
          perceive, process, and cite real estate professionals across the open web.
        </p>
        <p className="text-xs text-muted-foreground">
          Your inclusion is free and earned. This plan is provided at no cost and no obligation.
        </p>
        <p className="text-xs text-muted-foreground">
          Questions? <a href="mailto:hello@top10lists.us" className="text-primary hover:underline">hello@top10lists.us</a>
        </p>
      </div>
    </div>
  );
}
