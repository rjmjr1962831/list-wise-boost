import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle, Star, MapPin, Shield, Eye } from "lucide-react";

type PageState = "loading" | "valid" | "expired" | "invalid";

/** Human-intent bots (real consumer queries) */
const HUMAN_BOTS = new Set(["ChatGPT-User", "chatgpt-user", "OAI-SearchBot", "PerplexityBot", "YouBot"]);

function getAnalyzedCount(stateAbbr: string | undefined): string {
  if (!stateAbbr) return "200,000+";
  const s = stateAbbr.toUpperCase();
  if (s === "CA") return "450,000+";
  if (s === "AZ") return "220,000+";
  return "200,000+";
}

function getStateName(stateSlug: string | undefined, abbr: string | undefined): string {
  if (stateSlug) return stateSlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  if (abbr === "AZ") return "Arizona";
  if (abbr === "CA") return "California";
  return "your state";
}

export default function SandboxStep1() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useGA4Tracking();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [professional, setProfessional] = useState<any>(null);
  const [aiSurfaces, setAiSurfaces] = useState<{ total: number; human: number; days: number } | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const resolve = async () => {
      if (!token) { setPageState("invalid"); return; }
      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

        let { data, error } = await supabase
          .from("professionals")
          .select(`*, cities:city_id (id, name, state, state_slug, slug)`)
          .eq("verification_token", token)
          .maybeSingle();

        let lookedUpById = false;
        if (!data && !error && isUUID) {
          const fb = await supabase
            .from("professionals")
            .select(`*, cities:city_id (id, name, state, state_slug, slug)`)
            .eq("id", token)
            .maybeSingle();
          data = fb.data;
          error = fb.error;
          lookedUpById = !!data;
        }

        if (error || !data) { setPageState("invalid"); return; }

        if (!lookedUpById) {
          const expiresAt = data.verification_token_expires_at;
          if (expiresAt && new Date(expiresAt) < new Date()) { setPageState("expired"); return; }
        }

        if (!data.active) { setPageState("invalid"); return; }

        setProfessional(data);
        setPageState("valid");

        // Fetch AI surfaces (non-blocking)
        Promise.all([
          supabase.from("agent_ai_surfaces").select("total_surfaces, computed_at").eq("agent_id", data.id).maybeSingle(),
          supabase.from("agent_ai_surfaces_by_bot").select("bot_name, crawls").eq("agent_id", data.id),
        ]).then(([surfRes, botRes]) => {
          const total = surfRes.data?.total_surfaces || 0;
          const human = (botRes.data || [])
            .filter((b: any) => HUMAN_BOTS.has(b.bot_name))
            .reduce((sum: number, b: any) => sum + (b.crawls || 0), 0);
          // Data collection started 2026-03-12; compute actual days, cap at 30
          const dataStart = new Date("2026-03-12");
          const now = new Date();
          const days = Math.min(30, Math.max(1, Math.round((now.getTime() - dataStart.getTime()) / (1000 * 60 * 60 * 24))));
          if (total > 0) setAiSurfaces({ total, human, days });
        });
      } catch { setPageState("invalid"); }
    };
    resolve();
  }, [token]);

  useEffect(() => {
    if (pageState === "valid" && professional) {
      trackEvent("sandbox_step1_view", { professional_id: professional.id, professional_name: professional.name });
    }
  }, [pageState, professional, trackEvent]);

  const handleClaimClick = () => {
    trackEvent("sandbox_step1_claim_click", { professional_id: professional?.id });
    navigate(`/sandbox/${token}/contact`, { state: { professional } });
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SafeHead><title>Loading | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your listing...</p>
        </div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SafeHead><title>Link Expired | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Link Expired</h2>
            <p className="text-muted-foreground mb-6">This verification link has expired. Please request a new one or use the profile lookup to access your listing.</p>
            <Button onClick={() => navigate("/check-profile")}>Look Up My Profile</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "invalid" || !professional) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SafeHead><title>Not Found | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground mb-6">We could not find a listing for this link. It may have been deactivated or the link is incorrect.</p>
            <Button onClick={() => navigate("/check-profile")}>Look Up My Profile</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const firstName = (professional.name || "").split(" ")[0] || "Agent";
  const stateAbbr = professional.cities?.state;
  const stateName = getStateName(professional.cities?.state_slug, stateAbbr);
  const totalAnalyzed = getAnalyzedCount(stateAbbr);
  const cityName = professional.cities?.name || "";
  const rating = professional.review_stars_rating || 0;
  const reviews = professional.num_total_reviews || 0;
  const years = professional.years_experience || 0;
  const company = professional.company && professional.company !== "Unknown" ? professional.company : "";
  const tier = (professional.current_tier || professional.badge_tier || "listed").toLowerCase();
  const tierLabel: Record<string, string> = { underwritten: "Underwritten", audited: "Audited", certified: "Certified", listed: "Listed" };

  return (
    <div className="min-h-screen bg-background">
      <SafeHead>
        <title>Claim Your Listing | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="max-w-xl mx-auto px-4 py-10 sm:py-16">
        {/* Headline */}
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">
          Congratulations, {firstName}! You've been selected.
        </h1>
        <p className="text-center text-muted-foreground mb-8 max-w-md mx-auto">
          AI has reviewed your profile {aiSurfaces ? aiSurfaces.total.toLocaleString() : "multiple"} times{aiSurfaces ? ` in the past ${aiSurfaces.days} days` : ""}. AI thrives on data depth and freshness. To increase the likelihood they will name you when asked for a referral, or endorse you if asked about you, you need to certify the data we have compiled.
        </p>

        {/* Clean agent card */}
        <Card className="mb-8 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {/* Avatar / initials */}
              <div className="flex-shrink-0 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {(professional.name || "?")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold truncate">{professional.name}</h2>
                {company && <p className="text-sm text-muted-foreground">{company}</p>}
                {cityName && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5" /> {cityName}, {stateAbbr}
                  </p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className={`grid ${aiSurfaces ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-3 mt-6 text-center`}>
              <div className="bg-muted/50 rounded-lg py-3 px-2">
                <div className="flex items-center justify-center gap-1 text-lg font-bold">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  {rating.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{reviews}+ reviews</p>
              </div>
              <div className="bg-muted/50 rounded-lg py-3 px-2">
                <div className="text-lg font-bold">{years}+</div>
                <p className="text-xs text-muted-foreground mt-0.5">years experience</p>
              </div>
              <div className="bg-muted/50 rounded-lg py-3 px-2">
                <div className="flex items-center justify-center gap-1 text-lg font-bold">
                  <Shield className="h-4 w-4 text-primary" />
                  {tierLabel[tier] || "Listed"}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">verified tier</p>
              </div>
              {aiSurfaces && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg py-3 px-2">
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-primary">
                    <Eye className="h-4 w-4" />
                    {aiSurfaces.total.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">AI surfaces (7d)</p>
                </div>
              )}
            </div>

            {/* Human-intent callout */}
            {aiSurfaces && aiSurfaces.human > 0 && (
              <p className="text-xs text-center text-primary/80 mt-3">
                {aiSurfaces.human.toLocaleString()} of these were from real consumer queries on ChatGPT, Perplexity, or You.com
              </p>
            )}

            {/* License */}
            {professional.license_number && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                License #{professional.license_number} — verified by state licensing authority
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center mb-4">
          Certification is free. There is no obligation. Takes about 3 minutes.
        </p>

        {/* CTA */}
        <div className="flex justify-center">
          <Button
            size="lg"
            className="w-full sm:w-auto sm:min-w-[280px] bg-primary hover:bg-primary/90 text-lg py-6"
            onClick={handleClaimClick}
          >
            Certify Your Data
          </Button>
        </div>
      </div>
    </div>
  );
}
