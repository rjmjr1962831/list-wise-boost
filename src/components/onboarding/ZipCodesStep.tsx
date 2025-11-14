import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { MapPin, DollarSign } from 'lucide-react';
import { OnboardingData } from '@/pages/AgentOnboarding';
import { supabase } from '@/integrations/supabase/client';
import zipCodeData from '@/data/zipCodeData.json';

interface ZipCodesStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface CityWithZips {
  id: string;
  name: string;
  zipCodes: Array<{ code: string; tier: number }>;
}

const ZIP_PRICING: Record<number, number> = {
  1: 15,
  2: 30,
  3: 40,
  4: 75,
  5: 100,
};

export function ZipCodesStep({ data, updateData, onNext, onBack }: ZipCodesStepProps) {
  const [citiesWithZips, setCitiesWithZips] = useState<CityWithZips[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [estimatedCost, setEstimatedCost] = useState(0);

  useEffect(() => {
    fetchCitiesWithZips();
  }, [data.cities]);

  useEffect(() => {
    calculateEstimatedCost();
  }, [data.zipCodes]);

  const fetchCitiesWithZips = async () => {
    try {
      const { data: citiesData, error } = await supabase
        .from('cities')
        .select('id, name, slug')
        .in('id', data.cities || []);

      if (error) throw error;

      const citiesWithZipsData: CityWithZips[] = (citiesData || []).map((city) => {
        // Filter the zip code array by matching city name
        const cityZips = (zipCodeData as any[]).filter(
          (zipEntry: any) => zipEntry.city.toLowerCase() === city.name.toLowerCase()
        );
        
        return {
          id: city.id,
          name: city.name,
          zipCodes: cityZips.map((zip: any) => ({
            code: zip.zipCode,
            tier: zip.agentValue || 1, // Map agentValue (1-5) to tier
          })),
        };
      });

      setCitiesWithZips(citiesWithZipsData);
    } catch (error) {
      console.error('Error fetching cities:', error);
      toast.error('Failed to load zip codes');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateEstimatedCost = () => {
    let total = 0;
    let isFirstZip = true;
    
    Object.entries(data.zipCodes || {}).forEach(([cityId, zips]) => {
      const city = citiesWithZips.find((c) => c.id === cityId);
      if (city) {
        zips.forEach((zipCode) => {
          const zipInfo = city.zipCodes.find((z) => z.code === zipCode);
          if (zipInfo) {
            // First zip is free, subsequent zips are priced by tier
            if (isFirstZip) {
              isFirstZip = false;
            } else {
              total += ZIP_PRICING[zipInfo.tier] || 15;
            }
          }
        });
      }
    });
    setEstimatedCost(total);
  };

  const toggleZipCode = (cityId: string, zipCode: string) => {
    const currentZips = data.zipCodes || {};
    const cityZips = currentZips[cityId] || [];

    if (cityZips.includes(zipCode)) {
      updateData({
        zipCodes: {
          ...currentZips,
          [cityId]: cityZips.filter((z) => z !== zipCode),
        },
      });
    } else {
      updateData({
        zipCodes: {
          ...currentZips,
          [cityId]: [...cityZips, zipCode],
        },
      });
    }
  };

  const selectAllForCity = (cityId: string) => {
    const city = citiesWithZips.find((c) => c.id === cityId);
    if (city) {
      updateData({
        zipCodes: {
          ...data.zipCodes,
          [cityId]: city.zipCodes.map((z) => z.code),
        },
      });
    }
  };

  const calculateCityTotalCost = (cityId: string): number => {
    const city = citiesWithZips.find((c) => c.id === cityId);
    if (!city) return 0;
    return city.zipCodes.reduce((sum, zip) => sum + (ZIP_PRICING[zip.tier] || 10), 0);
  };

  const handleNext = () => {
    const totalZips = Object.values(data.zipCodes || {}).reduce(
      (sum, zips) => sum + zips.length,
      0
    );

    if (totalZips === 0) {
      toast.error('Required: Please select at least one zip code to continue', {
        description: 'Expand a city below and check at least one zip code',
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
          <CardTitle>Select Your Target Zip Codes *</CardTitle>
          <CardDescription>
            Choose specific zip codes within your service cities for targeted visibility.
            <span className="font-semibold text-foreground"> You must select at least one zip code to continue.</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cities with Zip Codes */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading zip codes...
            </div>
          ) : citiesWithZips.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No cities selected in the previous step.</p>
              <Button variant="outline" onClick={onBack}>
                Go Back to Select Cities
              </Button>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {citiesWithZips.map((city) => {
                const selectedCount = (data.zipCodes?.[city.id] || []).length;
                return (
                  <AccordionItem key={city.id} value={city.id} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-medium">{city.name}</span>
                        </div>
                        <Badge variant={selectedCount > 0 ? 'default' : 'secondary'}>
                          {selectedCount} / {city.zipCodes.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => selectAllForCity(city.id)}
                          className="w-full"
                        >
                          All zip codes in this city will cost: ${calculateCityTotalCost(city.id)}/month
                        </Button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {city.zipCodes.map((zip) => {
                            const isSelected = data.zipCodes?.[city.id]?.includes(zip.code);
                            const price = ZIP_PRICING[zip.tier] || 10;
                            return (
                              <div
                                key={zip.code}
                                onClick={() => toggleZipCode(city.id, zip.code)}
                                className={`
                                  flex items-center justify-between gap-2 p-3 rounded-lg border cursor-pointer
                                  transition-all hover:shadow-md
                                  ${isSelected 
                                    ? 'bg-primary/10 border-primary' 
                                    : 'bg-background border-border hover:border-primary/50'
                                  }
                                `}
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleZipCode(city.id, zip.code)}
                                    className="pointer-events-none"
                                  />
                                  <span className="font-mono text-sm">{zip.code}</span>
                                </div>
                                <span className="text-sm font-semibold text-primary">
                                  ${price}/mo
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Warning if no zip codes selected */}
      {Object.values(data.zipCodes || {}).reduce((sum, zips) => sum + zips.length, 0) === 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-amber-500 text-primary-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold">!</span>
              </div>
              <div>
                <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  Zip Code Selection Required
                </h4>
                <p className="text-sm text-muted-foreground">
                  Please expand a city above and select at least one zip code to continue to the next step.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          Back
        </Button>
        <Button onClick={handleNext}>
          Continue to Preview
        </Button>
      </div>
    </div>
  );
}
