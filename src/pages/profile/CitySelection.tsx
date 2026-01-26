import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Check, X, AlertCircle, Search } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface City {
  id: string;
  name: string;
  state: string;
  slug: string;
}

const MAX_CITIES = 5;

export default function CitySelection() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());
  const [professional, setProfessional] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      try {
        // Fetch professional
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        
        let { data: profData } = await supabase
          .from('professionals')
          .select('id, name, verification_token')
          .eq('verification_token', token)
          .maybeSingle();

        if (!profData && isUUID) {
          const fallback = await supabase
            .from('professionals')
            .select('id, name, verification_token')
            .eq('id', token)
            .maybeSingle();
          profData = fallback.data;
        }

        if (!profData) {
          navigate('/');
          return;
        }

        setProfessional(profData);

        // Fetch cities - Arizona and California where we have coverage
        const { data: citiesData, error: citiesError } = await supabase
          .from('cities')
          .select('id, name, slug, state')
          .eq('active', true)
          .in('state', ['Arizona', 'California'])
          .order('state')
          .order('name');

        if (citiesError) {
          console.error('Error fetching cities:', citiesError);
          return;
        }

        setCities(citiesData || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, navigate]);

  const toggleCity = (cityId: string) => {
    setValidationError(null);
    
    setSelectedCityIds(prev => {
      const next = new Set(prev);
      if (next.has(cityId)) {
        next.delete(cityId);
      } else {
        if (next.size >= MAX_CITIES) {
          toast({
            title: "Limit reached",
            description: `You can select up to ${MAX_CITIES} cities.  Limiting selection improves accuracy and trust.`,
            variant: "default",
          });
          return prev;
        }
        next.add(cityId);
      }
      return next;
    });
  };

  const removeCity = (cityId: string) => {
    setSelectedCityIds(prev => {
      const next = new Set(prev);
      next.delete(cityId);
      return next;
    });
  };

  // Filter cities by search
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return cities;
    const query = searchQuery.toLowerCase();
    return cities.filter(city => 
      city.name.toLowerCase().includes(query) ||
      city.state.toLowerCase().includes(query)
    );
  }, [cities, searchQuery]);

  // Group cities by state for display
  const citiesByState = useMemo(() => {
    const grouped: Record<string, City[]> = {};
    filteredCities.forEach(city => {
      if (!grouped[city.state]) {
        grouped[city.state] = [];
      }
      grouped[city.state].push(city);
    });
    return grouped;
  }, [filteredCities]);

  const selectedCities = useMemo(() => {
    return cities.filter(c => selectedCityIds.has(c.id));
  }, [cities, selectedCityIds]);

  const handleContinue = async () => {
    if (selectedCityIds.size === 0) {
      setValidationError('Please select at least one city to continue.');
      return;
    }

    if (!professional) return;
    
    setSubmitting(true);

    try {
      // Save selected cities and mark verification complete
      const { error } = await supabase.functions.invoke('save-city-selection', {
        body: {
          professionalId: professional.id,
          cityIds: Array.from(selectedCityIds),
          markVerified: true
        }
      });

      if (error) {
        console.error('Error saving cities:', error);
        toast({
          title: "Error",
          description: "Failed to save your city selection.  Please try again.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Navigate to neighborhood selection
      navigate(`/profile/${token}/select-neighborhoods`);
    } catch (error) {
      console.error('Error:', error);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading cities...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Select Your Cities | Top10Lists</title>
        <meta name="description" content="Choose cities where you have verified experience" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold">
              Choose at least one city where you have verified experience
            </h1>
            <p className="text-muted-foreground">
              AI systems rely on location context when answering recommendation questions.  Selecting cities helps us associate your profile with places you actually work.  We only publish cities we can verify.
            </p>
            <p className="text-sm text-muted-foreground/80">
              You must have closed at least one transaction in the past 24 months in the cities you select.
            </p>
          </div>

          {/* Selected Cities Display */}
          {selectedCities.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    Selected ({selectedCities.length}/{MAX_CITIES})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCities.map(city => (
                    <Badge 
                      key={city.id} 
                      variant="secondary"
                      className="pl-3 pr-1 py-1.5 text-sm cursor-pointer hover:bg-secondary/80"
                      onClick={() => removeCity(city.id)}
                    >
                      {city.name}, {city.state}
                      <X className="h-3 w-3 ml-2" />
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* City Selection */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* City List */}
              <ScrollArea className="h-[400px] rounded-md border p-4">
                {Object.entries(citiesByState).map(([state, stateCities]) => (
                  <div key={state} className="mb-6 last:mb-0">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                      {state}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {stateCities.map(city => {
                        const isSelected = selectedCityIds.has(city.id);
                        return (
                          <button
                            key={city.id}
                            onClick={() => toggleCity(city.id)}
                            className={`
                              flex items-center gap-2 p-3 rounded-lg border text-left transition-all
                              ${isSelected 
                                ? 'border-primary bg-primary/5 text-primary' 
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              }
                            `}
                          >
                            <MapPin className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className="text-sm font-medium truncate">{city.name}</span>
                            {isSelected && (
                              <Check className="h-4 w-4 ml-auto flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {filteredCities.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No cities found matching "{searchQuery}"
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Validation Error */}
          {validationError && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{validationError}</span>
            </div>
          )}

          {/* Continue Button */}
          <Button
            size="lg"
            className="w-full"
            disabled={selectedCityIds.size === 0 || submitting}
            onClick={handleContinue}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Continue'
            )}
          </Button>

          {selectedCityIds.size === 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Select at least one city to continue.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
