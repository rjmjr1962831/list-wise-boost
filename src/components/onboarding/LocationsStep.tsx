import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, Check } from 'lucide-react';
import { OnboardingData } from '@/pages/AgentOnboarding';
import { supabase } from '@/integrations/supabase/client';
import { zipCodeData } from '@/data/zipCodeLookup';
import { ContactSupportBanner } from './ContactSupportBanner';

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
  const [availableStates, setAvailableStates] = useState<{ name: string; abbr: string; slug: string }[]>([]);

  useEffect(() => {
    // Get unique states from zipCodeData
    const uniqueStates = Array.from(
      new Set(zipCodeData.map(city => city.state))
    ).map(stateName => {
      const cityData = zipCodeData.find(c => c.state === stateName);
      return {
        name: stateName,
        abbr: cityData?.state_abbreviation || '',
        slug: stateName.toLowerCase().replace(/\s+/g, '-')
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    
    setAvailableStates(uniqueStates);
    setIsLoading(false);
  }, []);

  const handleStateChange = async (stateName: string) => {
    const selectedState = availableStates.find(s => s.name === stateName);
    if (!selectedState) return;
    
    updateData({ 
      state: selectedState.name, 
      stateSlug: selectedState.slug,
      cities: [] // Reset cities when state changes
    });
    
    setIsLoading(true);
    try {
      const { data: citiesData, error } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('state_slug', selectedState.slug)
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
    if (!data.state) {
      toast.error('Required: Please select a state', {
        description: 'Choose the state where you provide services',
        duration: 5000,
      });
      return;
    }
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
      <ContactSupportBanner />
      <Card>
        <CardHeader>
          <CardTitle>Service Areas</CardTitle>
          <CardDescription>
            Confirm your state and select the cities where you provide services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* State Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Your State *</label>
            <Select value={data.state} onValueChange={handleStateChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a state..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableStates.map((state) => (
                  <SelectItem key={state.abbr} value={state.name}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Count & Actions */}
          {data.state && (
            <>
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
            </>
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
