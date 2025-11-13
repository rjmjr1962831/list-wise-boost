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
  1: 10,
  2: 20,
  3: 30,
  4: 50,
  5: 75,
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
        const citySlug = city.slug as keyof typeof zipCodeData;
        const zipData = zipCodeData[citySlug];
        
        // Handle different possible data structures
        let zipInfo: Array<{ zipCode: string; tier?: number }> = [];
        if (Array.isArray(zipData)) {
          zipInfo = zipData as Array<{ zipCode: string; tier?: number }>;
        }
        
        return {
          id: city.id,
          name: city.name,
          zipCodes: zipInfo.map((zip) => ({
            code: zip.zipCode,
            tier: zip.tier || 1,
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
    Object.entries(data.zipCodes || {}).forEach(([cityId, zips]) => {
      const city = citiesWithZips.find((c) => c.id === cityId);
      if (city) {
        zips.forEach((zipCode) => {
          const zipInfo = city.zipCodes.find((z) => z.code === zipCode);
          if (zipInfo) {
            total += ZIP_PRICING[zipInfo.tier] || 10;
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

  const handleNext = () => {
    const totalZips = Object.values(data.zipCodes || {}).reduce(
      (sum, zips) => sum + zips.length,
      0
    );

    if (totalZips === 0) {
      toast.error('Please select at least one zip code');
      return;
    }

    onNext();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <Card>
        <CardHeader>
          <CardTitle>Select Your Target Zip Codes</CardTitle>
          <CardDescription>
            Choose specific zip codes within your service cities for targeted visibility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cost Estimate */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-sunset-orange/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Estimated Monthly Cost</p>
                <p className="text-2xl font-bold text-foreground">
                  ${estimatedCost}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {Object.values(data.zipCodes || {}).reduce((sum, zips) => sum + zips.length, 0)} zip codes selected
            </Badge>
          </div>

          {/* Pricing Info */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <p className="text-sm font-medium mb-2">Pricing Tiers (per zip code/month):</p>
            <div className="grid grid-cols-5 gap-2 text-xs">
              {Object.entries(ZIP_PRICING).map(([tier, price]) => (
                <div key={tier} className="flex items-center gap-1">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                    {tier}
                  </Badge>
                  <span className="text-muted-foreground">${price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cities with Zip Codes */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading zip codes...
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
                          Select All Zip Codes
                        </Button>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {city.zipCodes.map((zip) => {
                            const isSelected = data.zipCodes?.[city.id]?.includes(zip.code);
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
                                <Badge variant="outline" className="text-xs">
                                  T{zip.tier}
                                </Badge>
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
