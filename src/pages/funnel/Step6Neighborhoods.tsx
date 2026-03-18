import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight, ArrowLeft, Search, X, Plus, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FunnelBreadcrumbs } from '@/components/funnel/FunnelBreadcrumbs';

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
  name?: string;
  neighborhood?: string;
  slug?: string;
  neighborhood_slug?: string;
  city?: string;
  city_slug?: string;
  distance_miles: number;
}

export default function Step6Neighborhoods() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [agentState, setAgentState] = useState<string | null>(null);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());

  // Search state
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Neighborhood[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selection state
  const [selectedList, setSelectedList] = useState<Neighborhood[]>([]);

  // Nearby suggestions state
  const [nearbyItems, setNearbyItems] = useState<NearbyItem[]>([]);
  const [anchorName, setAnchorName] = useState<string | null>(null);

  useEffect(() => {
    loadAgent();
  }, [token]);

  const loadAgent = async () => {
    if (!token) { navigate('/404'); return; }
    try {
      const { data } = await supabase
        .from('professionals')
        .select('state_slug')
        .eq('verification_token', token)
        .single();
      if (!data) { navigate('/404'); return; }
      const stateMap: Record<string, string> = { arizona: 'Arizona', california: 'California' };
      setAgentState(stateMap[data.state_slug] || data.state_slug);

      // Get selected cities from Step 6 navigation state
      const navState = location.state as any;
      if (navState?.selectedCities) {
        setSelectedCities(new Set(navState.selectedCities));
      }
    } catch { navigate('/404'); }
    finally { setLoading(false); }
  };

  // Debounced search
  useEffect(() => {
    if (query.length < 2 || !agentState) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from('neighborhood_catalog')
          .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, nearby_neighborhoods')
          .eq('state', agentState)
          .eq('is_active', true)
          .ilike('neighborhood', `%${query}%`)
          .order('neighborhood')
          .limit(15);
        setSuggestions(data || []);
      } catch { setSuggestions([]); }
      finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, agentState]);

  const addNeighborhood = useCallback((n: Neighborhood) => {
    if (selectedList.some(s => s.id === n.id)) return;
    setSelectedList(prev => [...prev, n]);

    // Parse nearby and show suggestions
    if (n.nearby_neighborhoods) {
      try {
        const nearby: NearbyItem[] = JSON.parse(n.nearby_neighborhoods);
        // Filter out already-selected and the anchor itself
        const filtered = nearby.filter(nb =>
          nb.id !== n.id && !selectedList.some(s => s.id === nb.id)
        );
        setNearbyItems(filtered);
        setAnchorName(n.neighborhood);
      } catch { setNearbyItems([]); }
    }

    // Clear search
    setQuery('');
    setSuggestions([]);
  }, [selectedList]);

  const addNearbyItem = useCallback((nb: NearbyItem) => {
    const displayName = nb.name || nb.neighborhood || '';
    const displaySlug = nb.slug || nb.neighborhood_slug || '';
    const displayCity = nb.city || nb.city_slug || '';
    const asNeighborhood: Neighborhood = {
      id: nb.id,
      neighborhood: displayName,
      neighborhood_slug: displaySlug,
      city_area: displayCity,
      city_area_slug: nb.city_slug || '',
      state: agentState || '',
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
    setQuery('');
  };

  const handleContinue = async () => {
    // Save selections (fire and forget)
    if (selectedList.length > 0) {
      try {
        const { data: prof } = await supabase
          .from('professionals')
          .select('id')
          .eq('verification_token', token)
          .single();
        if (prof) {
          // Save as neighborhood subscriptions or similar
          // For now, pass through navigation state
        }
      } catch { /* continue anyway */ }
    }
    navigate(`/funnel/${token}/pricing`, {
      state: { ...(location.state || {}), selectedNeighborhoods: selectedList.map(n => n.id) },
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <>
      <SafeHead>
        <title>Select Neighborhoods | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <FunnelBreadcrumbs currentStep={7} />
          <Card className="!bg-white/5 border-white/10 mt-3">
            <CardHeader>
              <CardTitle className="text-white">Which neighborhoods are you an expert in?</CardTitle>
              <p className="text-sm text-slate-400">
                Search and add the specific neighborhoods where your closed transaction history is strongest. We verify these selections against public transaction records.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[380px]">

                {/* ═══ Left: Search + Nearby Suggestions ═══ */}
                <div className="flex flex-col border border-white/10 rounded-lg bg-white/[0.02]">
                  {/* Search bar */}
                  <div className="p-3 border-b border-white/10">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
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
                        {isSearching && <p className="text-sm text-slate-500">Searching...</p>}
                        {!isSearching && suggestions.length === 0 && <p className="text-sm text-slate-500">No matches</p>}
                        {!isSearching && suggestions.length > 0 && (
                          <ul className="space-y-1 mb-4">
                            {suggestions.map((n) => {
                              const alreadySelected = selectedList.some(s => s.id === n.id);
                              return (
                                <li
                                  key={n.id}
                                  className={cn(
                                    'px-3 py-2 rounded cursor-pointer text-sm transition-colors',
                                    alreadySelected ? 'bg-white/5 text-slate-600 cursor-not-allowed' : 'hover:bg-white/10 text-white'
                                  )}
                                  onClick={() => !alreadySelected && addNeighborhood(n)}
                                >
                                  <span className="font-medium">{n.neighborhood}</span>
                                  <span className="text-slate-500 ml-1">({n.city_area})</span>
                                  {alreadySelected && <span className="text-emerald-400 ml-2 text-xs">Added</span>}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}

                    {/* Nearby suggestions (shown after anchor selection) */}
                    {query.length < 2 && nearbyItems.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="h-4 w-4 text-primary" />
                          <p className="text-sm text-slate-300 font-medium">
                            Nearby {anchorName}:
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {nearbyItems.map((nb) => {
                            const alreadySelected = selectedList.some(s => s.id === nb.id);
                            if (alreadySelected) return null;
                            return (
                              <button
                                key={nb.id}
                                onClick={() => addNearbyItem(nb)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white hover:bg-primary/20 hover:border-primary/30 transition-colors"
                              >
                                <span>{nb.name || nb.neighborhood}</span>
                                <span className="text-slate-500 text-xs">{nb.distance_miles.toFixed(1)}mi</span>
                                <Plus className="h-3 w-3 text-primary" />
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={resetSearch}
                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          Search a different area
                        </button>
                      </div>
                    )}

                    {/* Empty state */}
                    {query.length < 2 && nearbyItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <Search className="h-8 w-8 text-slate-700 mb-3" />
                        <p className="text-sm text-slate-500">
                          {agentState ? `Search ${agentState} neighborhoods` : 'Loading...'}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          After you select one, we'll suggest nearby areas
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ═══ Right: Selected list ═══ */}
                <div className="flex flex-col border border-white/10 rounded-lg bg-white/[0.02]">
                  <div className="p-3 border-b border-white/10 font-medium text-sm text-white">
                    Selected ({selectedList.length})
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 max-h-[320px]">
                    {selectedList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <MapPin className="h-8 w-8 text-slate-700 mb-3" />
                        <p className="text-sm text-slate-500">No neighborhoods selected yet</p>
                        <p className="text-xs text-slate-600 mt-1">Search and click to add</p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {selectedList.map((n) => (
                          <li
                            key={n.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-white/5 border border-white/10"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-white block truncate">{n.neighborhood}</span>
                              <span className="text-xs text-slate-500">{n.city_area}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0 text-slate-400 hover:text-white"
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

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/funnel/${token}/cities`)}
                  className="gap-2 border-white/20 text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleContinue}
                  className="flex-1 gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
