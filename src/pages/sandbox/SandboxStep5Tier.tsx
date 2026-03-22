import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { TierPricingCalculator } from "@/components/pricing/TierPricingCalculator";

type CertificationTier = "certified" | "audited" | "underwritten";

function normalizeTier(t: string | null | undefined): CertificationTier {
  const t0 = (t || "").toLowerCase();
  if (t0 === "audited" || t0 === "accredited") return "audited";
  if (t0 === "underwritten") return "underwritten";
  return "certified";
}

function getBandLabel(score: number): string {
  if (score <= 30) return "Invisible";
  if (score <= 50) return "Discoverable";
  if (score <= 70) return "Citable";
  if (score <= 85) return "Citable (local)";
  return "Authoritative";
}

const VALUE_CARDS = [
  {
    title: "What AI sees at Listed (free)",
    items: ["Name, license, rating, basic profile"],
    note: "AI can mention you, but has little to go on.",
    highlighted: false,
  },
  {
    title: "What AI sees at Audited ($300/mo)",
    items: ["Transaction history, community roles, specialties, expanded neighborhoods"],
    note: "AI has enough data to endorse you confidently.",
    highlighted: true,
  },
  {
    title: "What AI sees at Underwritten ($500/mo)",
    items: ["Full neighborhood detail, press mentions, daily monitoring, certifications"],
    note: "AI treats you as a definitive answer.",
    highlighted: false,
  },
];

export default function SandboxStep5Tier() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useGA4Tracking();

  const passedProfessional = (location.state as any)?.professional ?? null;
  const passedCityIds: string[] = (location.state as any)?.selectedCityIds ?? [];

  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [savingTier, setSavingTier] = useState<string | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const load = async () => {
      if (!token) { navigate("/check-profile"); return; }

      let prof = passedProfessional;

      if (!prof) {
        try {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
          const profSelect = "id, name, email, current_tier, badge_tier, signal_score, cities:city_id (name, state, state_slug, slug)";
          let { data, error } = await supabase
            .from("professionals")
            .select(profSelect)
            .eq("verification_token", token)
            .maybeSingle();
          if (!data && !error && isUUID) {
            const fb = await supabase
              .from("professionals")
              .select(profSelect)
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
      trackEvent("sandbox_step5_tier_view", {
        professional_id: professional.id,
      });
    }
  }, [loading, professional, trackEvent]);

  const currentTier = normalizeTier(professional?.current_tier ?? professional?.badge_tier);
  const currentAifs = professional?.signal_score ?? 24;

  const handleSelectTier = async (tier: CertificationTier) => {
    if (!token || !professional) return;

    trackEvent("sandbox_tier_selected", {
      professional_id: professional.id,
      tier,
    });

    setSavingTier(tier);
    try {
      if (tier === "certified") {
        const { data, error } = await supabase.functions.invoke("funnel-select-tier", {
          body: { token, tier: "certified" },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("Certified tier activated!");
        navigate(`/sandbox/${token}/success`, {
          state: { professional, tier: "certified" },
        });
      } else {
        // Paid tiers go to neighborhood selection
        navigate(`/sandbox/${token}/neighborhoods`, {
          state: {
            professional,
            tier,
            selectedCityIds: passedCityIds,
          },
        });
      }
    } catch (err: unknown) {
      let msg = "Failed to save tier selection.";
      if (err && typeof err === "object" && "message" in err) {
        msg = (err as { message: string }).message;
      }
      toast.error(msg);
    } finally {
      setSavingTier(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SafeHead><title>Choose Your Tier | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) return null;

  const projectedCertified = Math.min(95, currentAifs + 18);
  const projectedAudited = Math.min(95, currentAifs + 28);
  const projectedUnderwritten = Math.min(95, currentAifs + 37);

  return (
    <div className="min-h-screen bg-background">
      <SafeHead>
        <title>Choose Your Tier | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">
          Choose your verification tier.
        </h1>
        <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
          Every tier includes the same merit-based ranking. Higher tiers give AI systems more reasons to name you.
        </p>

        {/* AIFS Score Display */}
        <div className="rounded-lg border bg-muted/30 p-4 mb-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Your current AIFS: <span className="font-bold text-foreground text-lg">{currentAifs}</span>
            <span className="ml-2 text-xs">({getBandLabel(currentAifs)})</span>
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <span>Certified: <span className="font-semibold text-primary">{projectedCertified}</span> ({getBandLabel(projectedCertified)})</span>
            <span>Audited: <span className="font-semibold text-primary">{projectedAudited}</span> ({getBandLabel(projectedAudited)})</span>
            <span>Underwritten: <span className="font-semibold text-primary">{projectedUnderwritten}</span> ({getBandLabel(projectedUnderwritten)})</span>
          </div>
        </div>

        {/* Tier Pricing Calculator */}
        <TierPricingCalculator
          currentTier={currentTier}
          currentAifs={currentAifs}
          onSelectTier={handleSelectTier}
          savingTier={savingTier}
        />

        {/* Value Education Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 mb-6">
          {VALUE_CARDS.map((card) => (
            <Card
              key={card.title}
              className={card.highlighted ? "border-primary border-2" : ""}
            >
              <CardContent className="pt-5 pb-4">
                <h3 className="font-semibold text-sm mb-3">{card.title}</h3>
                <ul className="space-y-1.5 mb-3">
                  {card.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground italic">{card.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-sm text-muted-foreground text-center mb-6 max-w-xl mx-auto">
          Payment affects verification depth and refresh frequency. It never affects your ranking or inclusion.
        </p>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/sandbox/${token}/cities`, { state: { professional } })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex-1" />
          <button
            className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
            onClick={() => handleSelectTier("certified")}
          >
            Stay with your free listing
          </button>
        </div>
      </div>
    </div>
  );
}
