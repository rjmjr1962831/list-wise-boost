import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight, ArrowLeft, Search, X, Plus, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackFunnelEvent } from '@/lib/funnel-track';
import { FunnelBreadcrumbs } from '@/components/funnel/FunnelBreadcrumbs';
import { RevenueGapBanner } from '@/components/funnel/RevenueGapBanner';

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

/**
 * Parse nearby_neighborhoods field — handles both formats:
 * AZ: JSON array of { id, neighborhood, city, distance_miles, ... }
 * CA: semicolon-delimited "Name, City; Name, City; ..."
 */
function parseNearbyField(raw: string | null | undefined): { isJson: boolean; items: NearbyItem[]; textPairs: { name: string; city: string }[] } {
  if (!raw) return { isJson: false, items: [], textPairs: [] };
  const trimmed = raw.trim();

  // Try JSON first (AZ format)
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const items: NearbyItem[] = parsed.map((p: any) => ({
        id: p.id,
        name: p.name || p.neighborhood || '',
        city: p.city || p.city_slug || '',
        distance_miles: p.distance_miles ?? null,
      }));
      return { isJson: true, items, textPairs: [] };
    } catch { /* fall through */ }
  }

  // Semicolon-delimited format (CA format): "Name, City; Name, City"
  const pairs = trimmed.split(';').map(s => s.trim()).filter(Boolean);
  const textPairs = pairs.map(pair => {
    const lastComma = pair.lastIndexOf(',');
    if (lastComma === -1) return { name: pair, city: '' };
    return { name: pair.slice(0, lastComma).trim(), city: pair.slice(lastComma + 1).trim() };
  });
  return { isJson: false, items: [], textPairs };
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
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [anchorName, setAnchorName] = useState<string | null>(null);

  useEffect(() => {
    loadAgent();
  }, [token]);

  const loadAgent = async () => {
    if (!token) { navigate('/404'); return; }
    try {
      const { data } = await supabase
        .from('professionals')
        .select('id, name, state_slug')
        .eq('verification_token', token)
        .single();
      if (!data) { navigate('/404'); return; }
      trackFunnelEvent('funnel_step_neighborhoods', { id: data.id, name: data.name });
      const stateMap: Record<string, string> = { arizona: 'Arizona', california: 'California' };
      setAgentState(stateMap[data.state_slug] || data.state_slug);

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

  const resolveNearbyFromText = useCallback(async (
    textPairs: { name: string; city: string }[],
    excludeIds: string[],
  ) => {
    if (textPairs.length === 0) return;
    setNearbyLoading(true);
    try {
      // Look up neighborhoods by name matching
      const names = textPairs.map(p => p.name);
      const { data } = await supabase
        .from('neighborhood_catalog')
        .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug')
        .eq('state', agentState!)
        .eq('is_active', true)
        .in('neighborhood', names)
        .limit(50);

      if (data) {
        // Match by name AND city to avoid false positives
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

    // Parse nearby and show suggestions
    const parsed = parseNearbyField(n.nearby_neighborhoods);
    const excludeIds = nextList.map(s => s.id);
    setAnchorName(n.neighborhood);

    if (parsed.isJson) {
      // AZ format — already have IDs
      const filtered = parsed.items.filter(nb => !excludeIds.includes(nb.id));
      setNearbyItems(filtered);
    } else if (parsed.textPairs.length > 0) {
      // CA format — need to look up IDs from DB
      resolveNearbyFromText(parsed.textPairs, excludeIds);
    } else {
      setNearbyItems([]);
    }

    setQuery('');
    setSuggestions([]);
  }, [selectedList, resolveNearbyFromText]);

  const addNearbyItem = useCallback((nb: NearbyItem) => {
    const asNeighborhood: Neighborhood = {
      id: nb.id,
      neighborhood: nb.name,
      neighborhood_slug: '',
      city_area: nb.city,
      city_area_slug: '',
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
    try {
      const { data: trackProf } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('verification_token', token)
        .single();
      if (trackProf) {
        trackFunnelEvent('funnel_neighborhoods_selected', trackProf, { count: selectedList.length });
      }
    } catch { /* tracking is best-effort */ }

    if (selectedList.length > 0) {
      try {
        const { data: prof } = await supabase
          .from('professionals')
          .select('id')
          .eq('verification_token', token)
          .single();
        if (prof) {
          // Save selections through navigation state
        }
      } catch { /* continue anyway */ }
    }
    navigate(`/funnel/${token}/tier`, {
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
          <RevenueGapBanner professional={(location.state as any)?.professional as any} />
          <FunnelBreadcrumbs currentStep={7} />
          <Card className="!bg-white/5 border-white/10 mt-3">
            <CardHeader>
              <CardTitle className="text-white">Which neighborhoods are you an expert in?</CardTitle>
              <p className="text-sm text-slate-400">
                Choose the neighborhoods where you've closed the most deals. Most agents select 5-10. Each neighborhood you add strengthens your local AI visibility.
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
                    {query.length < 2 && (nearbyItems.length > 0 || nearbyLoading) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="h-4 w-4 text-primary" />
                          <p className="text-sm text-slate-300 font-medium">
                            Nearby {anchorName}:
                          </p>
                        </div>
                        {nearbyLoading ? (
                          <div className="flex items-center gap-2 text-sm text-slate-500">
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
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white hover:bg-primary/20 hover:border-primary/30 transition-colors"
                                >
                                  <span>{nb.name}</span>
                                  {nb.distance_miles != null && (
                                    <span className="text-slate-500 text-xs">{nb.distance_miles.toFixed(1)}mi</span>
                                  )}
                                  <Plus className="h-3 w-3 text-primary" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <button
                          onClick={resetSearch}
                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          Search a different area
                        </button>
                      </div>
                    )}

                    {/* Empty state */}
                    {query.length < 2 && nearbyItems.length === 0 && !nearbyLoading && (
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
