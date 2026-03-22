import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, ArrowLeft, Search, X, Plus, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Neighborhood {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  nearby_neighborhoods?: string | null;
}

interface NearbyItem {
  id: string;
  name: string;
  city: string;
  distance_miles: number | null;
}

function parseNearbyField(raw: string | null | undefined): { isJson: boolean; items: NearbyItem[]; textPairs: { name: string; city: string }[] } {
  if (!raw) return { isJson: false, items: [], textPairs: [] };
  const trimmed = raw.trim();

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const items: NearbyItem[] = parsed.map((p: any) => ({
        id: p.id,
        name: p.name || p.neighborhood || "",
        city: p.city || p.city_slug || "",
        distance_miles: p.distance_miles ?? null,
      }));
      return { isJson: true, items, textPairs: [] };
    } catch { /* fall through */ }
  }

  const pairs = trimmed.split(";").map(s => s.trim()).filter(Boolean);
  const textPairs = pairs.map(pair => {
    const lastComma = pair.lastIndexOf(",");
    if (lastComma === -1) return { name: pair, city: "" };
    return { name: pair.slice(0, lastComma).trim(), city: pair.slice(lastComma + 1).trim() };
  });
  return { isJson: false, items: [], textPairs };
}

export default function SandboxStep6Neighborhoods() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useGA4Tracking();

  const passedProfessional = (location.state as any)?.professional ?? null;
  const passedTier: string = (location.state as any)?.tier ?? "audited";
  const passedCityIds: string[] = (location.state as any)?.selectedCityIds ?? [];

  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [agentState, setAgentState] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Neighborhood[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selection state
  const [selectedList, setSelectedList] = useState<Neighborhood[]>([]);

  // Nearby suggestions
  const [nearbyItems, setNearbyItems] = useState<NearbyItem[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [anchorName, setAnchorName] = useState<string | null>(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const load = async () => {
      if (!token) { navigate("/check-profile"); return; }

      let prof = passedProfessional;

      if (!prof) {
        try {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
          const profSelect = "id, name, email, state_slug, license_state, current_tier, badge_tier, signal_score";
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

      const stateSlug = prof.state_slug || prof.license_state || "arizona";
      const stateMap: Record<string, string> = { arizona: "Arizona", california: "California" };
      setAgentState(stateMap[stateSlug] || stateSlug);

      setLoading(false);
    };
    load();
  }, [token]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2 || !agentState) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from("neighborhood_catalog")
          .select("id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, nearby_neighborhoods")
          .eq("state", agentState)
          .eq("is_active", true)
          .ilike("neighborhood", `%${query}%`)
          .order("neighborhood")
          .limit(15);
        setSuggestions(data || []);
      } catch { setSuggestions([]); }
      finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, agentState]);

  const resolveNearbyFromText = useCallback(async (
    textPairs: { name: string; city: string }[],
    excludeIds: string[],
  ) => {
    if (textPairs.length === 0) return;
    setNearbyLoading(true);
    try {
      const names = textPairs.map(p => p.name);
      const { data } = await supabase
        .from("neighborhood_catalog")
        .select("id, neighborhood, neighborhood_slug, city_area, city_area_slug")
        .eq("state", agentState!)
        .eq("is_active", true)
        .in("neighborhood", names)
        .limit(50);

      if (data) {
        const matched: NearbyItem[] = [];
        for (const pair of textPairs) {
          const match = data.find(d =>
            d.neighborhood === pair.name &&
            d.city_area === pair.city &&
            !excludeIds.includes(d.id)
          );
          if (match) {
            matched.push({
              id: match.id,
              name: match.neighborhood,
              city: match.city_area,
              distance_miles: null,
            });
          }
        }
        setNearbyItems(matched);
      }
    } catch { /* best effort */ }
    finally { setNearbyLoading(false); }
  }, [agentState]);

  const addNeighborhood = useCallback((n: Neighborhood) => {
    if (selectedList.some(s => s.id === n.id)) return;
    const nextList = [...selectedList, n];
    setSelectedList(nextList);

    const parsed = parseNearbyField(n.nearby_neighborhoods);
    const excludeIds = nextList.map(s => s.id);
    setAnchorName(n.neighborhood);

    if (parsed.isJson) {
      const filtered = parsed.items.filter(nb => !excludeIds.includes(nb.id));
      setNearbyItems(filtered);
    } else if (parsed.textPairs.length > 0) {
      resolveNearbyFromText(parsed.textPairs, excludeIds);
    } else {
      setNearbyItems([]);
    }

    setQuery("");
    setSuggestions([]);
  }, [selectedList, resolveNearbyFromText]);

  const addNearbyItem = useCallback((nb: NearbyItem) => {
    const asNeighborhood: Neighborhood = {
      id: nb.id,
      neighborhood: nb.name,
      neighborhood_slug: "",
      city_area: nb.city,
      city_area_slug: "",
      state: agentState || "",
    };
    setSelectedList(prev => [...prev, asNeighborhood]);
    setNearbyItems(prev => prev.filter(item => item.id !== nb.id));
  }, [agentState]);

  const removeNeighborhood = useCallback((id: string) => {
    setSelectedList(prev => prev.filter(n => n.id !== id));
  }, []);

  const resetSearch = () => {
    setNearbyItems([]);
    setAnchorName(null);
    setQuery("");
  };

  const handleContinue = async () => {
    if (selectedList.length === 0) {
      toast.error("Please select at least one neighborhood.");
      return;
    }
    if (!professional) return;

    trackEvent("sandbox_step6_neighborhoods_selected", {
      professional_id: professional.id,
      neighborhood_count: selectedList.length,
      tier: passedTier,
    });

    setCheckoutLoading(true);
    try {
      const email = professional.email;
      if (!email) {
        toast.error("Email is required for checkout. Please go back and add your email.");
        setCheckoutLoading(false);
        return;
      }

      const monthlyTotal = passedTier === "underwritten" ? 500 : 300;
      const baseUrl = window.location.origin;

      const { data, error } = await supabase.functions.invoke("create-agent-checkout", {
        body: {
          professionalId: professional.id,
          email,
          badgeTier: passedTier,
          badgeBillingPeriod: "monthly",
          monthlyTotal,
          successUrl: `${baseUrl}/sandbox/${token}/success`,
          cancelUrl: `${baseUrl}/sandbox/${token}/tier`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: unknown) {
      let msg = "Failed to start checkout.";
      if (err && typeof err === "object" && "message" in err) {
        msg = (err as { message: string }).message;
      }
      toast.error(msg);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SafeHead><title>Select Neighborhoods | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) return null;

  return (
    <div className="min-h-screen bg-background">
      <SafeHead>
        <title>Select Neighborhoods | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">
          Select your neighborhoods.
        </h1>
        <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
          Neighborhood-level presence is where AI citation gets specific. When someone asks "who is the best agent in Arcadia," your verified presence in that neighborhood is what gets you named.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Search and select neighborhoods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[380px]">
              {/* Left: Search + Nearby */}
              <div className="flex flex-col border rounded-lg bg-muted/30">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={nearbyItems.length > 0 ? "Search another area..." : "Search your primary neighborhood..."}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 max-h-[320px]">
                  {/* Search results */}
                  {query.length >= 2 && (
                    <>
                      {isSearching && <p className="text-sm text-muted-foreground">Searching...</p>}
                      {!isSearching && suggestions.length === 0 && <p className="text-sm text-muted-foreground">No matches</p>}
                      {!isSearching && suggestions.length > 0 && (
                        <ul className="space-y-1 mb-4">
                          {suggestions.map((n) => {
                            const alreadySelected = selectedList.some(s => s.id === n.id);
                            return (
                              <li
                                key={n.id}
                                className={cn(
                                  "px-3 py-2 rounded cursor-pointer text-sm transition-colors",
                                  alreadySelected ? "bg-muted text-muted-foreground cursor-not-allowed" : "hover:bg-muted"
                                )}
                                onClick={() => !alreadySelected && addNeighborhood(n)}
                              >
                                <span className="font-medium">{n.neighborhood}</span>
                                <span className="text-muted-foreground ml-1">({n.city_area})</span>
                                {alreadySelected && <span className="text-primary ml-2 text-xs">Added</span>}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  )}

                  {/* Nearby suggestions */}
                  {query.length < 2 && (nearbyItems.length > 0 || nearbyLoading) && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">Nearby {anchorName}:</p>
                      </div>
                      {nearbyLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Finding nearby neighborhoods...
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {nearbyItems.map((nb) => {
                            const alreadySelected = selectedList.some(s => s.id === nb.id);
                            if (alreadySelected) return null;
                            return (
                              <button
                                key={nb.id}
                                onClick={() => addNearbyItem(nb)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border text-sm hover:bg-primary/10 hover:border-primary/30 transition-colors"
                              >
                                <span>{nb.name}</span>
                                {nb.distance_miles != null && (
                                  <span className="text-muted-foreground text-xs">{nb.distance_miles.toFixed(1)}mi</span>
                                )}
                                <Plus className="h-3 w-3 text-primary" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button
                        onClick={resetSearch}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Search a different area
                      </button>
                    </div>
                  )}

                  {/* Empty state */}
                  {query.length < 2 && nearbyItems.length === 0 && !nearbyLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {agentState ? `Search ${agentState} neighborhoods` : "Loading..."}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        After you select one, we'll suggest nearby areas
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Selected list */}
              <div className="flex flex-col border rounded-lg bg-muted/30">
                <div className="p-3 border-b font-medium text-sm">
                  Selected ({selectedList.length})
                </div>
                <div className="flex-1 overflow-y-auto p-3 max-h-[320px]">
                  {selectedList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <MapPin className="h-8 w-8 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">No neighborhoods selected yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Search and click to add</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {selectedList.map((n) => (
                        <li
                          key={n.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-muted/50 border"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium block truncate">{n.neighborhood}</span>
                            <span className="text-xs text-muted-foreground">{n.city_area}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0"
                            onClick={() => removeNeighborhood(n.id)}
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {selectedList.length > 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                {selectedList.length} {selectedList.length === 1 ? "neighborhood" : "neighborhoods"} selected
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/sandbox/${token}/tier`, {
              state: { professional, selectedCityIds: passedCityIds },
            })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            disabled={selectedList.length === 0 || checkoutLoading}
            onClick={handleContinue}
          >
            {checkoutLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
            ) : (
              <>Continue to Checkout <ArrowRight className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
