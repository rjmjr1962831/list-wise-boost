import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";

function tierLabel(tier: string): string {
  if (tier === "audited") return "Audited";
  if (tier === "underwritten") return "Underwritten";
  return "Certified";
}

export default function SandboxSuccess() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useGA4Tracking();

  const passedProfessional = (location.state as any)?.professional ?? null;
  const passedTier: string = (location.state as any)?.tier ?? "certified";

  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [tier] = useState(passedTier);

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
            .select("id, name, current_tier, badge_tier, cities:city_id (name, state_slug, slug)")
            .eq("verification_token", token)
            .maybeSingle();
          if (!data && !error && isUUID) {
            const fb = await supabase
              .from("professionals")
              .select("id, name, current_tier, badge_tier, cities:city_id (name, state_slug, slug)")
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
  }, [token, passedProfessional, navigate]);

  useEffect(() => {
    if (!loading && professional) {
      trackEvent("sandbox_funnel_complete", {
        professional_id: professional.id,
        tier,
      });
    }
  }, [loading, professional, tier, trackEvent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SafeHead><title>Success | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) return null;

  const firstName = (professional.name || "").split(" ")[0] || "Agent";
  const isFree = tier === "certified" || tier === "listed";
  const citySlug = professional.cities?.slug;
  const stateSlug = professional.cities?.state_slug;
  const publicUrl = stateSlug && citySlug ? `/${stateSlug}/${citySlug}` : "/check-profile";

  return (
    <div className="min-h-screen bg-background">
      <SafeHead>
        <title>You're All Set | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="max-w-lg mx-auto px-4 py-8 sm:py-16">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />

            {isFree ? (
              <>
                <h1 className="text-2xl font-bold mb-2">
                  You're all set, {firstName}.
                </h1>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Your listing is live and AI systems can reference it right now.
                </p>
                <div className="text-left bg-muted/50 rounded-lg p-4 mb-6 text-sm space-y-2">
                  <p>
                    <strong>Quarterly refresh:</strong> Your data will be re-verified every 90 days at no cost.
                  </p>
                  <p>
                    <strong>Citation compounding:</strong> The longer your listing stays active, the more frequently AI systems reference it.
                  </p>
                  <p>
                    <strong>Upgrade anytime:</strong> You can switch to a paid tier whenever you want more depth and faster refresh cycles.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-2">
                  Welcome to {tierLabel(tier)}, {firstName}.
                </h1>
                <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                  {tier === "underwritten"
                    ? "Your profile now receives daily monitoring and maximum data depth. AI systems have every reason to name you as a definitive answer."
                    : "Your profile now receives monthly refreshes with expanded data. AI systems have significantly more information to cite when recommending you."}
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Your AI Footprint Score will update within 24 hours to reflect your new tier.
                </p>
              </>
            )}

            <div className="flex flex-col gap-3">
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => navigate(publicUrl)}
              >
                View My Public Listing
              </Button>
              {isFree ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/sandbox/${token}/tier`)}
                >
                  Explore Upgrade Options
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/badge-instructions")}
                >
                  Set Up Your Badge
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
