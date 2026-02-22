import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight, ArrowLeft, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Neighborhood {
  id: string;
  neighborhood: string;
  city_area: string;
  state: string;
}

function stateSlugToFullState(slugOrAbbr: string | null | undefined): string {
  if (!slugOrAbbr) return 'Arizona';
  const s = slugOrAbbr.toLowerCase().trim();
  if (s === 'az' || s === 'arizona') return 'Arizona';
  if (s === 'ca' || s === 'california') return 'California';
  if (s === 'tx' || s === 'texas') return 'Texas';
  if (s === 'fl' || s === 'florida') return 'Florida';
  if (s === 'co' || s === 'colorado') return 'Colorado';
  if (s === 'ny' || s === 'new-york') return 'New York';
  return slugOrAbbr.charAt(0).toUpperCase() + slugOrAbbr.slice(1).replace(/-/g, ' ');
}

interface ProfessionalForPricing {
  id: string;
  name: string;
  years_experience: number | null;
  total_sales: number | null;
  num_total_reviews: number | null;
  review_stars_rating: number | null;
  license_number: string | null;
  license_state: string | null;
  state_slug: string | null;
  community_involvement_score: number | null;
  community_roles: unknown[] | null;
  agent_sales_stats: { countLastYear?: number; countAllTime?: number } | null;
}

export default function Step6Neighborhoods() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const passedProfessional = (location.state as { professional?: ProfessionalForPricing } | null)?.professional;
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<ProfessionalForPricing | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Neighborhood[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedList, setSelectedList] = useState<Neighborhood[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/404');
      return;
    }
    if (passedProfessional) {
      setProfessional(passedProfessional);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const profSelect = 'id, name, years_experience, total_sales, num_total_reviews, review_stars_rating, license_number, license_state, state_slug, community_involvement_score, community_roles, agent_sales_stats';
        const { data } = await supabase.from('professionals').select(profSelect).eq('verification_token', token).maybeSingle();
        if (data) setProfessional(data as ProfessionalForPricing);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [token, navigate, passedProfessional]);

  const agentState = professional ? stateSlugToFullState(professional.license_state || professional.state_slug) : null;

  const searchNeighborhoods = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    if (!agentState) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('neighborhood_catalog')
        .select('id, neighborhood, city_area, state')
        .eq('is_active', true)
        .eq('state', agentState)
        .or(`neighborhood.ilike.%${trimmed}%,city_area.ilike.%${trimmed}%`)
        .order('city_area')
        .order('neighborhood')
        .limit(15);

      if (error) throw error;
      setSuggestions((data || []) as Neighborhood[]);
    } catch (err) {
      console.error(err);
      setSuggestions([]);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [agentState]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchNeighborhoods(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchNeighborhoods]);

  const addNeighborhood = (n: Neighborhood) => {
    if (selectedList.some(s => s.id === n.id)) return;
    setSelectedList(prev => [...prev, n]);
    setQuery('');
    setSuggestions([]);
  };

  const removeNeighborhood = (id: string) => {
    setSelectedList(prev => prev.filter(n => n.id !== id));
  };

  const handleContinue = () => {
    toast.success(`${selectedList.length} neighborhood${selectedList.length !== 1 ? 's' : ''} selected!`);
    navigate(`/funnel/${token}/pricing`, { state: professional ? { professional } : undefined });
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
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 5 of 7</span>
                <span className="text-sm font-medium">Select Neighborhoods</span>
              </div>
              <CardTitle>Which neighborhoods are you an expert in?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Optional: Select specific neighborhoods where you have deep expertise. Type to search and add as many as you like.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Two-column selection widget */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[320px]">
                {/* Left: Search + matches */}
                <div className="flex flex-col border rounded-lg bg-muted/30">
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Type to search neighborhoods..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 max-h-[260px]">
                    {!agentState && (
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    )}
                    {agentState && query.length < 2 && (
                      <p className="text-sm text-muted-foreground">Type at least 2 characters to search {agentState} neighborhoods</p>
                    )}
                    {agentState && query.length >= 2 && isSearching && (
                      <p className="text-sm text-muted-foreground">Searching...</p>
                    )}
                    {agentState && query.length >= 2 && !isSearching && suggestions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No matches</p>
                    )}
                    {agentState && query.length >= 2 && !isSearching && suggestions.length > 0 && (
                      <ul className="space-y-1">
                        {suggestions.map((n) => {
                          const alreadySelected = selectedList.some(s => s.id === n.id);
                          return (
                            <li
                              key={n.id}
                              className={cn(
                                'px-3 py-2 rounded cursor-pointer text-sm transition-colors',
                                alreadySelected ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'hover:bg-accent'
                              )}
                              onClick={() => !alreadySelected && addNeighborhood(n)}
                            >
                              <span className="font-medium">{n.neighborhood}</span>
                              <span className="text-muted-foreground ml-1">({n.city_area}, {n.state})</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Right: Selected list */}
                <div className="flex flex-col border rounded-lg bg-muted/30">
                  <div className="p-3 border-b font-medium text-sm">
                    Selected ({selectedList.length})
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 max-h-[260px]">
                    {selectedList.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No neighborhoods selected yet</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedList.map((n) => (
                          <li
                            key={n.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-background border"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium block truncate">{n.neighborhood}</span>
                              <span className="text-xs text-muted-foreground">{n.city_area}, {n.state}</span>
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

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/funnel/${token}/cities`)}
                  className="gap-2"
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
