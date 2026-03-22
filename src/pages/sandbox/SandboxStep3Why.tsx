import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, ArrowRight, MessageCircle, Search, ListOrdered, Eye } from "lucide-react";

interface BandInfo {
  label: string;
  min: number;
  max: number;
  description: string;
}

const BANDS: BandInfo[] = [
  { label: "Invisible", min: 0, max: 30, description: "AI has almost no verifiable data. Unlikely to be named." },
  { label: "Discoverable", min: 31, max: 50, description: "AI may include you on a long list, but will hedge its recommendation." },
  { label: "Citable", min: 51, max: 70, description: "AI may name you intermittently with a minor hedge." },
  { label: "Citable (local)", min: 71, max: 85, description: "AI names you in your market. Endorses without hedging." },
  { label: "Authoritative", min: 86, max: 95, description: "AI treats you as a definitive answer. Endorses without hesitation." },
];

function getBand(score: number): BandInfo {
  for (const b of BANDS) {
    if (score <= b.max) return b;
  }
  return BANDS[BANDS.length - 1];
}

const FLOW_STEPS = [
  {
    icon: MessageCircle,
    title: "Buyer asks AI",
    description: "\"Who is the best real estate agent in {city}?\"",
  },
  {
    icon: Search,
    title: "AI searches trusted sources",
    description: "Scans Top10Lists, checks credentials, reviews, transaction data.",
  },
  {
    icon: ListOrdered,
    title: "AI names agents",
    description: "Agents with deeper, verified profiles get cited more confidently.",
  },
  {
    icon: Eye,
    title: "Buyer contacts you",
    description: "Your profile, your reviews, your contact info. No referral fee.",
  },
];

export default function SandboxStep3Why() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useGA4Tracking();

  const passedProfessional = (location.state as any)?.professional ?? null;

  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const load = async () => {
      if (!token) { navigate("/check-profile"); return; }

      let prof = passedProfessional;

      if (!prof) {
        try {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
          let { data, error } = await supabase
            .from("professionals")
            .select("id, name, signal_score, cities:city_id (name, state)")
            .eq("verification_token", token)
            .maybeSingle();
          if (!data && !error && isUUID) {
            const fb = await supabase
              .from("professionals")
              .select("id, name, signal_score, cities:city_id (name, state)")
              .eq("id", token)
              .maybeSingle();
            data = fb.data; error = fb.error;
          }
          if (error || !data) { navigate("/check-profile"); return; }
          prof = data;
        } catch { navigate("/check-profile"); return; }
      }

      setProfessional(prof);
      setLoading(false);
    };
    load();
  }, [token]);

  useEffect(() => {
    if (!loading && professional) {
      const score = professional.signal_score ?? 24;
      trackEvent("sandbox_step3_education_view", {
        professional_id: professional.id,
        current_aifs: score,
      });
    }
  }, [loading, professional, trackEvent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SafeHead><title>Why This Matters | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) return null;

  const score = professional.signal_score ?? 24;
  const band = getBand(score);
  const agentCity = professional.cities?.name || "your city";

  // Replace placeholder in flow step 1
  const flowSteps = FLOW_STEPS.map((s, i) =>
    i === 0
      ? { ...s, description: s.description.replace("{city}", agentCity) }
      : s
  );

  return (
    <div className="min-h-screen bg-background">
      <SafeHead>
        <title>Why This Matters | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6">
          AI is replacing search. Here's what that means for you.
        </h1>

        {/* Section 1: The Shift */}
        <div className="space-y-4 mb-10 text-muted-foreground text-sm sm:text-base leading-relaxed">
          <p>
            When a buyer asks ChatGPT or Claude for a real estate agent recommendation, the AI doesn't return a list of links. It names someone. That name carries the AI's credibility with it, so AI systems are selective about who they recommend.
          </p>
          <p>
            To reduce risk, AI pulls from structured, verified sources it already trusts. Top10Lists is one of those sources.
          </p>
        </div>

        {/* Section 2: Visual Flow */}
        <div className="mb-10">
          {/* Desktop: horizontal */}
          <div className="hidden md:flex items-start gap-2">
            {flowSteps.map((step, i) => (
              <div key={i} className="flex items-start flex-1">
                <Card className="flex-1">
                  <CardContent className="pt-5 pb-4 px-4 text-center">
                    <step.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                    <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
                {i < flowSteps.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground mt-10 mx-1 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Mobile: vertical stack */}
          <div className="flex flex-col items-center gap-2 md:hidden">
            {flowSteps.map((step, i) => (
              <div key={i} className="w-full flex flex-col items-center">
                <Card className="w-full">
                  <CardContent className="pt-5 pb-4 px-4 flex items-start gap-4">
                    <step.icon className="h-8 w-8 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </CardContent>
                </Card>
                {i < flowSteps.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90 my-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: AIFS Bands */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4">AI Footprint Score Bands</h2>
          <div className="space-y-2">
            {BANDS.map((b) => {
              const isActive = band.label === b.label;
              return (
                <div
                  key={b.label}
                  className={`rounded-lg border p-3 text-sm ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">
                      {b.min}-{b.max}: {b.label}
                      {isActive && (
                        <span className="ml-2 text-xs text-primary font-normal">(You are here)</span>
                      )}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">{b.description}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
            <p className="text-sm">
              Your current score: <span className="font-bold text-primary">{score}</span>.
              You're in the '<span className="font-semibold">{band.label}</span>' band.
              The next step shows you how to move up.
            </p>
          </div>
        </div>

        {/* Section 4: Compounding */}
        <div className="mb-10">
          <p className="text-sm text-muted-foreground leading-relaxed">
            AI citation compounds. Every time an AI system references your profile successfully, it reinforces the pattern. Agents who build deeper profiles earlier develop stronger citation histories that are difficult for competitors to catch.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/sandbox/${token}/contact`, { state: { professional } })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={() => navigate(`/sandbox/${token}/cities`, { state: { professional } })}
          >
            Continue to City Selection
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
