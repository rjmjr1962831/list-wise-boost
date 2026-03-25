import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X, Plus, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { SandboxNugget } from './SandboxNugget';
import { SandboxProgress } from './SandboxProgress';
import { validateToken, getStateFromProfessional, useBasePath } from './utils';

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

  const pairs = trimmed.split(';').map(s => s.trim()).filter(Boolean);
  const textPairs = pairs.map(pair => {
    const lastComma = pair.lastIndexOf(',');
    if (lastComma === -1) return { name: pair, city: '' };
    return { name: pair.slice(0, lastComma).trim(), city: pair.slice(lastComma + 1).trim() };
  });
  return { isJson: false, items: [], textPairs };
}

export default function SandboxStep4Neighborhoods() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode') === 'sales' ? '?mode=sales' : '';
  const returnTo = searchParams.get('returnTo');
  const isDashboardEdit = returnTo === 'dashboard';
  const navState = location.state as any;

  const basePath = useBasePath();
  const { trackEvent } = useGA4Tracking();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [agentState, setAgentState] = useState<string | null>(null);
  const [allowedCityNames, setAllowedCityNames] = useState<string[]>([]);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Neighborhood[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedList, setSelectedList] = useState<Neighborhood[]>([]);
  const [nearbyItems, setNearbyItems] = useState<NearbyItem[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [anchorName, setAnchorName] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!token) return;
    validateToken(token).then(async (result) => {
      if (result.status !== 'valid' || !result.professional) {
        navigate(`${basePath}/${token}`);
        return;
      }
      const prof = result.professional;
      setProfessional(prof);
      const { stateName } = getStateFromProfessional(prof);
      setAgentState(stateName);

      // Resolve selected city IDs to city names for filtering neighborhoods
      const selectedCityIds: string[] = navState?.selectedCityIds || [];
      if (selectedCityIds.length > 0) {
        const { data: cityRows } = await supabase
          .from('cities')
          .select('name')
          .in('id', selectedCityIds);
        if (cityRows) {
          setAllowedCityNames(cityRows.map((c: any) => c.name));
        }
      } else if (isDashboardEdit && prof?.served_cities?.length > 0) {
        // Dashboard edit: filter to agent's served_cities slugs
        const { data: cityRows } = await supabase
          .from('cities')
          .select('name')
          .in('slug', prof.served_cities);
        if (cityRows) {
          setAllowedCityNames(cityRows.map((c: any) => c.name));
        }
      }

      setLoading(false);
    });
  }, [token]);

  // Debounced search — only neighborhoods in selected cities
  useEffect(() => {
    if (query.length < 2 || !agentState) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        let q = supabase
          .from('neighborhood_catalog')
          .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, nearby_neighborhoods')
          .eq('state', agentState)
          .eq('is_active', true)
          .ilike('neighborhood', `%${query}%`)
          .order('neighborhood')
          .limit(15);
        if (allowedCityNames.length > 0) {
          q = q.in('city_area', allowedCityNames);
        }
        const { data } = await q;
        setSuggestions(data || []);
      } catch { setSuggestions([]); }
      finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, agentState, allowedCityNames]);

  const resolveNearbyFromText = useCallback(async (
    textPairs: { name: string; city: string }[],
    excludeIds: string[],
  ) => {
    if (textPairs.length === 0) return;
    setNearbyLoading(true);
    try {
      // Build OR filter for fuzzy matching — nearby text names may not exactly match DB names
      const names = textPairs.map(p => p.name);
      const orFilter = names.map(n => `neighborhood.ilike.%${n.replace(/[\/\-]/g, '%')}%`).join(',');
      const { data } = await supabase
        .from('neighborhood_catalog')
        .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug')
        .eq('state', agentState!)
        .eq('is_active', true)
        .or(orFilter)
        .limit(50);

      if (data) {
        const matched: NearbyItem[] = [];
        const norm = (s: string) => s.toLowerCase().replace(/[\/\-_]/g, ' ').replace(/\s+/g, ' ').trim();
        for (const pair of textPairs) {
          const pairNorm = norm(pair.name);
          const pairCity = norm(pair.city);
          const match = data.find(d =>
            !excludeIds.includes(d.id) &&
            (allowedCityNames.length === 0 || allowedCityNames.includes(d.city_area)) &&
            (norm(d.neighborhood) === pairNorm ||
             norm(d.neighborhood).includes(pairNorm) ||
             pairNorm.includes(norm(d.neighborhood))) &&
            (!pair.city || norm(d.city_area).includes(pairCity) || pairCity.includes(norm(d.city_area)))
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
  }, [agentState, allowedCityNames]);

  const addNeighborhood = useCallback((n: Neighborhood) => {
    if (selectedList.some(s => s.id === n.id)) return;
    const nextList = [...selectedList, n];
    setSelectedList(nextList);

    const parsed = parseNearbyField(n.nearby_neighborhoods);
    const excludeIds = nextList.map(s => s.id);
    setAnchorName(n.neighborhood);

    if (parsed.isJson) {
      setNearbyItems(parsed.items.filter(nb =>
        !excludeIds.includes(nb.id) &&
        (allowedCityNames.length === 0 || allowedCityNames.includes(nb.city))
      ));
    } else if (parsed.textPairs.length > 0) {
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

  const handleContinue = async () => {
    trackEvent('sandbox_step4_neighborhoods_selected', {
      professional_id: professional?.id,
      neighborhood_count: selectedList.length,
    });

    if (isDashboardEdit && professional?.id) {
      // Save neighborhoods directly and return to dashboard
      const nhSlugs = selectedList.map((n: Neighborhood) => n.neighborhood_slug);
      const nhNames = selectedList.map((n: Neighborhood) => ({
        neighborhood: n.neighborhood,
        city_area: n.city_area,
      }));
      await Promise.all([
        supabase.functions.invoke('update-professional-field', {
          body: { professional_id: professional.id, field: 'served_neighborhoods', value: nhSlugs },
        }),
        supabase.functions.invoke('update-professional-field', {
          body: { professional_id: professional.id, field: 'neighborhoods', value: nhNames },
        }),
      ]);
      const dashToken = professional.verification_token || token;
      window.location.href = `/dashboard/${dashToken}`;
      return;
    }

    navigate(`${basePath}/${token}/tier${modeParam}`, {
      state: {
        selectedCityIds: navState?.selectedCityIds,
        selectedNeighborhoods: selectedList,
        professionalId: professional?.id,
        professional,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Select Neighborhoods | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <SandboxProgress currentStep={4} />

          <SandboxNugget>
            AI searches our neighborhood pages about 20 TIMES more than cities. Make sure you name all neighborhoods where you have at least 2 transactions in the last 2 years.
          </SandboxNugget>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Select your neighborhoods.</h1>
            <p className="text-muted-foreground text-sm">
              Neighborhood-level presence is where AI citation gets specific.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[380px]">
            {/* Left: Search + Nearby */}
            <div className="flex flex-col border rounded-lg">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={nearbyItems.length > 0 ? 'Search another area...' : 'Search neighborhoods...'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 max-h-[320px]">
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
                                'px-3 py-2 rounded cursor-pointer text-sm transition-colors',
                                alreadySelected ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'hover:bg-muted'
                              )}
                              onClick={() => !alreadySelected && addNeighborhood(n)}
                            >
                              <span className="font-medium">{n.neighborhood}</span>
                              <span className="text-muted-foreground ml-1">({n.city_area})</span>
                              {alreadySelected && <span className="text-emerald-500 ml-2 text-xs">Added</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}

                {query.length < 2 && (nearbyItems.length > 0 || nearbyLoading) && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">You might also want:</p>
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
                      onClick={() => { setNearbyItems([]); setAnchorName(null); setQuery(''); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Search a different area
                    </button>
                  </div>
                )}

                {query.length < 2 && nearbyItems.length === 0 && !nearbyLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {agentState ? `Search ${agentState} neighborhoods` : 'Loading...'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      After you select one, we'll suggest nearby areas
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Selected */}
            <div className="flex flex-col border rounded-lg">
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
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-muted border"
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

          <p className="text-sm text-muted-foreground">
            {selectedList.length} {selectedList.length === 1 ? 'neighborhood' : 'neighborhoods'} selected
          </p>

          <div className="flex justify-between pt-2">
            {isDashboardEdit ? (
              <Button variant="ghost" onClick={() => { const t = professional?.verification_token || token; window.location.href = `/dashboard/${t}`; }}>
                Cancel
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate(`${basePath}/${token}/cities${modeParam}`)}>
                Back
              </Button>
            )}
            <Button onClick={handleContinue} disabled={selectedList.length === 0}>
              {isDashboardEdit ? 'Save & Return to Dashboard' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
