import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { MapPin, Check } from 'lucide-react';
import { OnboardingData } from '@/pages/AgentOnboarding';
import { supabase } from '@/integrations/supabase/client';

interface LocationsStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface CityOption {
  id: string;
  name: string;
  slug: string;
}

export function LocationsStep({ data, updateData, onNext, onBack }: LocationsStepProps) {
  const [availableCities, setAvailableCities] = useState<CityOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stateInfo, setStateInfo] = useState<{ name: string; abbr: string } | null>(null);

  useEffect(() => {
    // For now, default to Arizona. In production, detect from profile or ask user
    const defaultState = { name: 'Arizona', abbr: 'AZ', slug: 'az' };
    setStateInfo(defaultState);
    updateData({ state: defaultState.name, stateSlug: defaultState.slug });
    fetchCities(defaultState.slug);
  }, []);

  const fetchCities = async (stateSlug: string) => {
    try {
      const { data: citiesData, error } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('state_slug', stateSlug)
        .eq('active', true)
        .order('name');

      if (error) throw error;

      setAvailableCities(citiesData || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
      toast.error('Failed to load cities');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCity = (cityId: string) => {
    const current = data.cities || [];
    if (current.includes(cityId)) {
      updateData({ cities: current.filter((id) => id !== cityId) });
    } else {
      updateData({ cities: [...current, cityId] });
    }
  };

  const selectAll = () => {
    updateData({ cities: availableCities.map((c) => c.id) });
  };

  const deselectAll = () => {
    updateData({ cities: [] });
  };

  const handleNext = () => {
    if ((data.cities?.length || 0) === 0) {
      toast.error('Required: Please select at least one city', {
        description: 'Choose the cities where you provide services',
        duration: 5000,
      });
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <Card>
        <CardHeader>
          <CardTitle>Service Areas</CardTitle>
          <CardDescription>
            Confirm your state and select the cities where you provide services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* State Confirmation */}
          {stateInfo && (
            <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Your State</p>
                <p className="text-lg font-semibold">{stateInfo.name}</p>
              </div>
              <Check className="h-5 w-5 text-green-600 ml-auto" />
            </div>
          )}

          {/* Selected Count & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Selected Cities:
              </span>
              <Badge variant="secondary">
                {data.cities?.length || 0} of {availableCities.length}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deselectAll}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Cities List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading cities...
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {availableCities.map((city) => {
                const isSelected = data.cities?.includes(city.id);
                return (
                  <div
                    key={city.id}
                    onClick={() => toggleCity(city.id)}
                    className={`
                      flex items-center gap-3 p-4 rounded-lg border cursor-pointer
                      transition-all hover:shadow-md
                      ${isSelected 
                        ? 'bg-primary/10 border-primary' 
                        : 'bg-background border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleCity(city.id)}
                      className="pointer-events-none"
                    />
                    <span className="font-medium">{city.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pricing Note */}
          {(data.cities?.length || 0) > 1 && (
            <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Note:</strong> Multiple city coverage may affect pricing. 
                Final pricing will be calculated at checkout.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          Back
        </Button>
        <Button onClick={handleNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
