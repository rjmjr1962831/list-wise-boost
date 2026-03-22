import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { BundlesPanel, type CityBundle } from "@/components/visibility/BundlesPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { REGIONAL_PACKAGES } from "@/data/arizonaPackages";
import { CALIFORNIA_PACKAGES, CA_CATEGORY_LABELS, CA_CATEGORY_ORDER } from "@/data/californiaPackages";

export default function SandboxStep4Cities() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useGA4Tracking();

  const passedProfessional = (location.state as any)?.professional ?? null;

  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [bundles, setBundles] = useState<CityBundle[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());
  const [catLabels, setCatLabels] = useState<Record<string, string> | undefined>(undefined);
  const [catOrder, setCatOrder] = useState<string[] | undefined>(undefined);
  const [saving, setSaving] = useState(false);

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
            .select("id, name, email, city_id, state_slug, license_state, current_tier, badge_tier, signal_score, cities:city_id (id, name, state, state_slug, slug)")
            .eq("verification_token", token)
            .maybeSingle();
          if (!data && !error && isUUID) {
            const fb = await supabase
              .from("professionals")
              .select("id, name, email, city_id, state_slug, license_state, current_tier, badge_tier, signal_score, cities:city_id (id, name, state, state_slug, slug)")
              .eq("id", token)
              .maybeSingle();
            data = fb.data; error = fb.error;
          }
          if (error || !data) { navigate("/check-profile"); return; }
          prof = data;
        } catch { navigate("/check-profile"); return; }
      }

      setProfessional(prof);

      // Determine state filter
      const stateSlug = prof.state_slug || prof.license_state || prof.cities?.state_slug || "arizona";
      const stateFilter = typeof stateSlug === "string" ? stateSlug.replace(/\s+/g, "-").toLowerCase() : "arizona";

      try {
        const { data: citiesData, error } = await supabase
          .from("cities")
          .select("id, name, slug, state_slug")
          .eq("active", true)
          .eq("state_slug", stateFilter)
          .order("name");

        if (error) throw error;

        const cityOptions = citiesData || [];
        const cityBySlug = new Map(cityOptions.map((c: any) => [c.slug, c.id]));
        const cityNameBySlug = new Map(cityOptions.map((c: any) => [c.slug, c.name]));

        if (stateFilter === "arizona") {
          const resolvedBundles: CityBundle[] = REGIONAL_PACKAGES.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            category: pkg.category,
            cityIds: pkg.includedCityIds
              .map((slug: string) => cityBySlug.get(slug))
              .filter((id): id is string => !!id),
            cityNames: pkg.includedCityIds
              .map((slug: string) => cityNameBySlug.get(slug))
              .filter((name): name is string => !!name),
          }));
          setBundles(resolvedBundles);
        } else if (stateFilter === "california") {
          const resolvedBundles: CityBundle[] = CALIFORNIA_PACKAGES.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            category: pkg.category,
            cityIds: pkg.includedCityIds
              .map((slug: string) => cityBySlug.get(slug))
              .filter((id): id is string => !!id),
            cityNames: pkg.includedCityIds
              .map((slug: string) => cityNameBySlug.get(slug))
              .filter((name): name is string => !!name),
          }));
          setBundles(resolvedBundles);
          setCatLabels(CA_CATEGORY_LABELS as Record<string, string>);
          setCatOrder(CA_CATEGORY_ORDER as string[]);
        }

        // Pre-select agent's current city
        if (prof.city_id) {
          setSelectedCityIds(new Set([prof.city_id]));
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load city data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleAddBundle = (_bundleId: string, cityIds: string[]) => {
    setSelectedCityIds(prev => {
      const next = new Set(prev);
      cityIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleContinue = async () => {
    if (selectedCityIds.size === 0) {
      toast.error("Please select at least one city.");
      return;
    }

    setSaving(true);
    try {
      // Save primary city via edge function
      await supabase.functions.invoke("save-free-city-selection", {
        body: {
          professionalId: professional.id,
          cityIds: Array.from(selectedCityIds),
        },
      });

      trackEvent("sandbox_step4_cities_selected", {
        professional_id: professional.id,
        city_count: selectedCityIds.size,
      });

      navigate(`/sandbox/${token}/tier`, {
        state: {
          professional,
          selectedCityIds: Array.from(selectedCityIds),
        },
      });
    } catch {
      toast.error("Failed to save city selection.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SafeHead><title>Select Cities | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) return null;

  const cityCount = selectedCityIds.size;

  return (
    <div className="min-h-screen bg-background">
      <SafeHead>
        <title>Select Cities | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">
          Where do you work?
        </h1>
        <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
          Select the cities where you serve clients. City listings are free for all qualified agents.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Select your coverage areas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BundlesPanel
              bundles={bundles}
              selectedCities={selectedCityIds}
              onAddBundle={handleAddBundle}
              categoryLabels={catLabels}
              categoryOrder={catOrder}
            />

            {cityCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {cityCount} {cityCount === 1 ? "city" : "cities"} selected
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/sandbox/${token}/why`, { state: { professional } })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            disabled={cityCount === 0 || saving}
            onClick={handleContinue}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
            ) : (
              <>Continue <ArrowRight className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
