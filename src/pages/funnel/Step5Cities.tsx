import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowRight, ArrowLeft, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface CityArea {
  city_area: string;
  city_area_slug: string;
  state: string;
}

type LocationState = { professionalId?: string; state_slug?: string | null; license_state?: string | null } | null;

export default function Step5Cities() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const passedState = location.state as LocationState;
  const [loading, setLoading] = useState(true);
  const [cityAreas, setCityAreas] = useState<CityArea[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [token, passedState?.professionalId]);

  const loadData = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    let agentState = '';

    if (passedState?.professionalId) {
      setProfessionalId(passedState.professionalId);
      agentState = passedState.license_state || passedState.state_slug || '';
    } else {
      try {
        const { data: prof, error: profError } = await supabase
          .from('professionals')
          .select('id, state_slug, license_state')
          .eq('verification_token', token)
          .single();

        if (profError || !prof) {
          navigate('/404');
          return;
        }

        setProfessionalId(prof.id);
        agentState = prof.license_state || prof.state_slug || '';
      } catch {
        navigate('/404');
        return;
      }
    }

    try {

      // Pull distinct city_area groups from neighborhood_catalog
      const allRows: { city_area: string; city_area_slug: string; state: string }[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('neighborhood_catalog')
          .select('city_area, city_area_slug, state')
          .eq('is_active', true)
          .order('city_area')
          .range(offset, offset + pageSize - 1);

        // Filter by agent's state if we know it
        if (agentState) {
          query = query.ilike('state', agentState.replace(/-/g, ' '));
        }

        const { data, error } = await query;
        if (error) throw error;

        allRows.push(...(data || []));
        hasMore = (data?.length || 0) === pageSize;
        offset += pageSize;
      }

      // Deduplicate by city_area_slug, filter junk
      const seen = new Map<string, CityArea>();
      for (const row of allRows) {
        if (
          row.city_area &&
          row.city_area_slug &&
          row.city_area.length > 1 &&
          !row.city_area.includes('null') &&
          !row.city_area.includes('Placeholder') &&
          !row.city_area.startsWith('/') &&
          !row.city_area.startsWith(':')
        ) {
          if (!seen.has(row.city_area_slug)) {
            seen.set(row.city_area_slug, {
              city_area: row.city_area,
              city_area_slug: row.city_area_slug,
              state: row.state,
            });
          }
        }
      }

      const sorted = Array.from(seen.values()).sort((a, b) =>
        a.city_area.localeCompare(b.city_area)
      );

      setCityAreas(sorted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load cities');
    } finally {
      setLoading(false);
    }
  };

  const toggleCity = (slug: string) => {
    const newSelected = new Set(selectedSlugs);
    if (newSelected.has(slug)) {
      newSelected.delete(slug);
    } else {
      newSelected.add(slug);
    }
    setSelectedSlugs(newSelected);
  };

  const handleContinue = () => {
    if (selectedSlugs.size === 0) {
      toast.error('Please select at least one city');
      return;
    }

    toast.success(`${selectedSlugs.size} cities selected!`);
    navigate(`/funnel/${token}/neighborhoods`);
  };

  const filtered = searchTerm
    ? cityAreas.filter((c) =>
        c.city_area.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : cityAreas;

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
        <title>Select Cities | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 4 of 7</span>
                <span className="text-sm font-medium">Select Cities</span>
              </div>
              <CardTitle>Which cities do you serve?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select all the cities where you help clients. You can select multiple.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto p-4 border rounded-lg">
                {filtered.map((city) => (
                  <div
                    key={city.city_area_slug}
                    className="flex items-center space-x-2 p-3 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => toggleCity(city.city_area_slug)}
                  >
                    <Checkbox
                      checked={selectedSlugs.has(city.city_area_slug)}
                      onCheckedChange={() => toggleCity(city.city_area_slug)}
                    />
                    <label className="cursor-pointer flex-1">
                      {city.city_area}, {city.state}
                    </label>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-3 text-center py-4">
                    No cities found{searchTerm ? ` matching "${searchTerm}"` : ''}.
                  </p>
                )}
              </div>

              {selectedSlugs.size > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  {selectedSlugs.size} {selectedSlugs.size === 1 ? 'city' : 'cities'} selected
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/funnel/${token}/review-final`)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={selectedSlugs.size === 0}
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
