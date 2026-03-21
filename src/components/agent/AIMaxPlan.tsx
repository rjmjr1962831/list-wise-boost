import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Target, AlertTriangle, CheckCircle2, XCircle, TrendingUp,
  Globe, Search, Users, FileCode, Quote, ChevronDown, ChevronUp,
  ExternalLink, Plus
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

function PillarBar({ label, score, maxScore, icon: Icon, description, fixes, isUnderwritten, hasWebOfTruth }: {
  label: string; score: number; maxScore: number; icon: any; description: string;
  fixes?: string[]; isUnderwritten?: boolean; hasWebOfTruth?: boolean;
}) {
  const [showFixes, setShowFixes] = useState(false);
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
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${textColor}`}>
            {score}/{maxScore}
          </span>
          {fixes && fixes.length > 0 && pct < 80 && (
            <button onClick={() => setShowFixes(!showFixes)} className="text-[10px] text-primary hover:underline font-medium">
              {showFixes ? "Hide" : "How to fix"}
            </button>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(0, pct)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {showFixes && fixes && (
        <div className="text-xs text-muted-foreground space-y-1 ml-4">
          {/* Top priorities with checkmarks */}
          <div className={`flex items-center gap-2 ${isUnderwritten ? "text-green-600" : "text-foreground font-semibold"}`}>
            {isUnderwritten ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-primary shrink-0" />}
            {isUnderwritten ? "Underwritten — active" : "Upgrade to Underwritten (biggest single impact)"}
          </div>
          <div className={`flex items-center gap-2 ${hasWebOfTruth ? "text-green-600" : "text-foreground font-semibold"}`}>
            {hasWebOfTruth ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-primary shrink-0" />}
            {hasWebOfTruth ? "Web of Truth — enabled" : "Enable your Web of Truth on every platform"}
          </div>
          <p className="font-semibold text-foreground mt-2 mb-1">Or:</p>
          {fixes.map((f, i) => (
            <li key={i} className="list-disc ml-2">{f}</li>
          ))}
        </div>
      )}
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

function PresenceItem({ exists, label, url, dbField, professionalId, onSaved }: {
  exists: boolean; label: string; url?: string; dbField?: string; professionalId?: string; onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!inputUrl.trim() || !dbField || !professionalId) return;
    setSaving(true);
    try {
      await supabase
        .from("professionals")
        .update({ [dbField]: inputUrl.trim() })
        .eq("id", professionalId);
      setEditing(false);
      setInputUrl("");
      onSaved?.();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {exists ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {exists && url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {!exists && dbField && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="flex items-center gap-2 mt-1.5 ml-6">
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder={`https://...`}
            className="flex-1 text-xs px-2 py-1 border rounded"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={saving || !inputUrl.trim()}
            className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "..." : "Save"}
          </button>
          <button
            onClick={() => { setEditing(false); setInputUrl(""); }}
            className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
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
  const rawTier = (professional.current_tier || professional.badge_tier || "certified").toLowerCase();
  const isUnderwritten = rawTier === "underwritten";
  const hasWebOfTruth = !!professional.profile_link;

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
            label="Identity"
            score={data.pillar_identity}
            maxScore={25}
            icon={Globe}
            description="AI must know exactly who you are before it will recommend you. Name consistency, license verification, entity disambiguation."
            isUnderwritten={isUnderwritten}
            hasWebOfTruth={hasWebOfTruth}
            fixes={[
              "Create a LinkedIn profile with your license and brokerage (+3 pts)",
              "Build a personal website with your name, license, and bio (+5 pts)",
              "Claim your Google Business Profile (+2 pts)",
            ]}
          />
          <PillarBar
            label="Citability"
            score={data.pillar_citability}
            maxScore={25}
            icon={Quote}
            description="Can AI extract and cite your credentials when recommending you? Machine-readable data, structured profiles, artifact presence."
            isUnderwritten={isUnderwritten}
            hasWebOfTruth={hasWebOfTruth}
            fixes={[
              "Get mentioned in local press or industry publications (+2 to +3 pts)",
              "Add schema markup to your personal website (+2 pts)",
              "Make sure your Zillow and Realtor.com bios are complete and match your Top10Lists profile (+1 to +2 pts)",
              "Ask your brokerage to link to your profile from their website (+1 to +2 pts)",
            ]}
          />
          <PillarBar
            label="Social Proof"
            score={data.pillar_social}
            maxScore={20}
            icon={Users}
            description="Reviews and ratings across platforms. AI weights recent, diverse reviews heavily when deciding who to recommend."
            isUnderwritten={isUnderwritten}
            hasWebOfTruth={hasWebOfTruth}
            fixes={[
              "Ask recent clients for reviews on Google and Zillow — AI weights the last 6 months most heavily (+3 to +5 pts)",
              "Get listed on Realtor.com if you're not already (+4 pts)",
              "Get listed on HomeLight (+3 pts)",
              "Respond to existing reviews — AI reads responses as engagement signals (+1 pt)",
            ]}
          />
          <PillarBar
            label="Authority"
            score={data.pillar_authority}
            maxScore={15}
            icon={Users}
            description="Third-party endorsements, press mentions, industry recognition. These are signals AI uses to distinguish you from similar agents."
            isUnderwritten={isUnderwritten}
            hasWebOfTruth={hasWebOfTruth}
            fixes={[
              "Get mentioned in local publications or industry press (+3 to +5 pts)",
              "Write a detailed professional bio for your profiles — AI reads these (+5 pts)",
              "Close more transactions — every 30 sales adds +1 pt (up to +8 pts)",
            ]}
          />
          <PillarBar
            label="Technical"
            score={data.pillar_technical}
            maxScore={15}
            icon={FileCode}
            description="Schema markup, website crawlability, structured data. This is the plumbing that lets AI read your information."
            isUnderwritten={isUnderwritten}
            hasWebOfTruth={hasWebOfTruth}
            fixes={[
              "Make sure your website loads and isn't blocking crawlers (+5 pts)",
              "Add LocalBusiness or RealEstateAgent schema markup to your website (+2 pts)",
              "Create a Facebook business page (+2 pts)",
              "Get listed on HomeLight and Realtor.com (+2 to +3 pts each)",
            ]}
          />
        </CardContent>
      </Card>

      {/* Where You're Found */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Where AI Systems Look for You
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
            <PresenceItem exists={hasZillow} label="Zillow" url={professional.zillow_profile_url || undefined} dbField="zillow_profile_url" professionalId={professional.id} onSaved={() => window.location.reload()} />
            <PresenceItem exists={hasLinkedin} label="LinkedIn" url={professional.social_linkedin || undefined} dbField="social_linkedin" professionalId={professional.id} onSaved={() => window.location.reload()} />
            <PresenceItem exists={hasRealtor} label="Realtor.com" url={professional.social_realtor_com || undefined} dbField="social_realtor_com" professionalId={professional.id} onSaved={() => window.location.reload()} />
            <PresenceItem exists={hasGoogle} label="Google Business Profile" url={professional.google_maps_url || undefined} dbField="google_maps_url" professionalId={professional.id} onSaved={() => window.location.reload()} />
            <PresenceItem exists={hasPersonalSite} label="Personal Website" url={professional.website || professional.google_website || data.website || undefined} dbField="website" professionalId={professional.id} onSaved={() => window.location.reload()} />
            <PresenceItem exists={hasHomelight} label="HomeLight" url={professional.social_homelight || undefined} dbField="social_homelight" professionalId={professional.id} onSaved={() => window.location.reload()} />
            <PresenceItem exists={hasHomesCom} label="Homes.com" url={professional.social_homes_com || undefined} dbField="social_homes_com" professionalId={professional.id} onSaved={() => window.location.reload()} />
            <PresenceItem exists={hasFacebook} label="Facebook" url={professional.social_facebook || undefined} dbField="social_facebook" professionalId={professional.id} onSaved={() => window.location.reload()} />
            <PresenceItem exists={hasInstagram} label="Instagram" url={professional.social_instagram || undefined} dbField="social_instagram" professionalId={professional.id} onSaved={() => window.location.reload()} />
            <PresenceItem exists={hasTiktok} label="TikTok" url={professional.social_tiktok || undefined} dbField="social_tiktok" professionalId={professional.id} onSaved={() => window.location.reload()} />
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
                aiMeaning: "AI sees expanded background research refreshed monthly. More likely to recommend you with detail and confidence.",
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

                {/* Certified vs Underwritten comparison */}
                <details className="mt-6 text-sm">
                  <summary className="cursor-pointer font-semibold text-primary hover:underline text-center">
                    What does Underwritten actually give AI that Certified doesn't?
                  </summary>
                  <div className="mt-4 space-y-4 text-muted-foreground">
                    <p>
                      We analyzed the actual data payloads AI systems receive when they crawl a Certified agent vs. an Underwritten agent on Top10Lists.us. The difference is not cosmetic — it fundamentally changes what AI can verify, cite, and recommend.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-3">
                        <p className="font-semibold text-foreground text-xs mb-2">Certified</p>
                        <ul className="text-xs space-y-1">
                          <li>4 data sections</li>
                          <li>~11 KB payload</li>
                          <li>Basic: name, license, rating, sales</li>
                          <li>2 external links in schema</li>
                          <li>2 specialties listed</li>
                          <li>Quarterly refresh</li>
                          <li>No community</li>
                          <li>No press mentions</li>
                          <li>No awards</li>
                          <li>No city-level verification</li>
                        </ul>
                      </div>
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                        <p className="font-semibold text-primary text-xs mb-2">Underwritten</p>
                        <ul className="text-xs space-y-1">
                          <li><strong>8 data sections</strong></li>
                          <li><strong>~16 KB payload</strong></li>
                          <li>Full: name, license, rating, sales, bio</li>
                          <li><strong>3+ external links</strong> in schema</li>
                          <li><strong>14+ specialties</strong> listed</li>
                          <li><strong>Daily refresh</strong></li>
                          <li><strong>Community roles verified</strong> (IRS 990)</li>
                          <li><strong>Press coverage</strong> (8+ mentions)</li>
                          <li><strong>Awards &amp; honors</strong> (10+ verified)</li>
                          <li><strong>Cities served</strong> (transaction-verified)</li>
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/50 border p-3 text-xs">
                      <p className="font-semibold text-foreground mb-1">Why this matters to AI:</p>
                      <p>
                        AI systems make recommendations based on evidence depth. A Certified payload gives AI enough to confirm you exist and meet minimum thresholds — but not enough to confidently recommend you over a competitor. An Underwritten payload gives AI verified community, press coverage, transaction-verified cities, and 14+ expertise signals. That's the difference between "this agent appears qualified" and "I can recommend this agent with confidence because I have independent evidence from 8+ sources."
                      </p>
                    </div>

                    <p className="text-xs text-center">
                      <strong className="text-foreground">Is it worth it?</strong> If AI is choosing between two agents and one has 4 data sections refreshed quarterly while the other has 8 sections refreshed daily with press, awards, and community verification — the decision isn't close.
                    </p>
                  </div>
                </details>
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
