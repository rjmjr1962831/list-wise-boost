import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { MapPin, Save, Search } from 'lucide-react';

interface Professional {
  id: string;
  name: string;
  company: string;
  website: string;
  zip_code: string | null;
  city_id: string;
}

interface City {
  id: string;
  name: string;
  state: string;
}

export const ZipCodeManager = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [zipCodes, setZipCodes] = useState<{ [key: string]: string }>({});

  // Arizona city default zip codes
  const DEFAULT_ZIPCODES: { [key: string]: string } = {
    'gilbert': '85295',
    'phoenix': '85004',
    'scottsdale': '85251',
    'chandler': '85224',
    'mesa': '85201',
    'tempe': '85281',
    'peoria': '85382',
    'glendale': '85301',
  };

  useEffect(() => {
    loadCities();
  }, []);

  useEffect(() => {
    if (selectedCity) {
      loadProfessionals(selectedCity);
    }
  }, [selectedCity]);

  const loadCities = async () => {
    const { data, error } = await supabase
      .from('cities')
      .select('id, name, state')
      .eq('active', true)
      .order('name');

    if (error) {
      toast.error('Failed to load cities');
      console.error(error);
      return;
    }

    setCities(data || []);
    if (data && data.length > 0) {
      setSelectedCity(data[0].id);
    }
  };

  const loadProfessionals = async (cityId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('professionals')
      .select('id, name, company, website, zip_code, city_id')
      .eq('city_id', cityId)
      .eq('active', true)
      .order('rank');

    if (error) {
      toast.error('Failed to load professionals');
      console.error(error);
      setLoading(false);
      return;
    }

    setProfessionals(data || []);
    
    // Initialize zipCodes state with current values
    const initialZips: { [key: string]: string } = {};
    data?.forEach(prof => {
      initialZips[prof.id] = prof.zip_code || '';
    });
    setZipCodes(initialZips);
    
    setLoading(false);
  };

  const handleZipCodeChange = (professionalId: string, value: string) => {
    // Only allow numbers and limit to 5 digits
    const cleaned = value.replace(/\D/g, '').slice(0, 5);
    setZipCodes(prev => ({
      ...prev,
      [professionalId]: cleaned
    }));
  };

  const extractZipFromWebsite = (website: string): string | null => {
    // Try to extract from common Zillow URL patterns
    // This is a simple heuristic - you may need to call an API to get accurate zip codes
    const cityName = cities.find(c => c.id === selectedCity)?.name.toLowerCase();
    if (cityName && DEFAULT_ZIPCODES[cityName]) {
      return DEFAULT_ZIPCODES[cityName];
    }
    return null;
  };

  const autoFillZipCodes = () => {
    const cityName = cities.find(c => c.id === selectedCity)?.name.toLowerCase();
    const defaultZip = cityName ? DEFAULT_ZIPCODES[cityName] : null;

    if (!defaultZip) {
      toast.error('No default zip code found for this city');
      return;
    }

    const newZipCodes: { [key: string]: string } = {};
    professionals.forEach(prof => {
      if (!zipCodes[prof.id]) {
        newZipCodes[prof.id] = defaultZip;
      } else {
        newZipCodes[prof.id] = zipCodes[prof.id];
      }
    });

    setZipCodes(newZipCodes);
    toast.success(`Auto-filled with ${defaultZip} for empty fields`);
  };

  const saveZipCode = async (professionalId: string) => {
    const zipCode = zipCodes[professionalId];
    
    if (!zipCode || zipCode.length !== 5) {
      toast.error('Please enter a valid 5-digit zip code');
      return;
    }

    const { error } = await supabase
      .from('professionals')
      .update({ zip_code: zipCode })
      .eq('id', professionalId);

    if (error) {
      toast.error('Failed to save zip code');
      console.error(error);
      return;
    }

    toast.success('Zip code saved');
    loadProfessionals(selectedCity); // Reload to show updated data
  };

  const saveAllZipCodes = async () => {
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const prof of professionals) {
      const zipCode = zipCodes[prof.id];
      
      if (zipCode && zipCode.length === 5) {
        const { error } = await supabase
          .from('professionals')
          .update({ zip_code: zipCode })
          .eq('id', prof.id);

        if (error) {
          errorCount++;
          console.error(`Failed to save zip for ${prof.name}:`, error);
        } else {
          successCount++;
        }
      }
    }

    setLoading(false);
    
    if (successCount > 0) {
      toast.success(`Saved ${successCount} zip code${successCount > 1 ? 's' : ''}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to save ${errorCount} zip code${errorCount > 1 ? 's' : ''}`);
    }

    loadProfessionals(selectedCity);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Zip Code Manager
        </CardTitle>
        <CardDescription>
          Manage zip codes for professionals. Zip codes are required for fetching accurate Zillow data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium">Select City</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full mt-1 p-2 border rounded-md"
            >
              {cities.map(city => (
                <option key={city.id} value={city.id}>
                  {city.name}, {city.state}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={autoFillZipCodes} variant="outline">
            <Search className="h-4 w-4 mr-2" />
            Auto-Fill Defaults
          </Button>
          <Button onClick={saveAllZipCodes} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save All
          </Button>
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : professionals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No professionals found</p>
          ) : (
            professionals.map(prof => (
              <div key={prof.id} className="flex gap-2 items-center p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{prof.name}</p>
                  <p className="text-sm text-muted-foreground">{prof.company}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="text"
                    placeholder="Zip code"
                    value={zipCodes[prof.id] || ''}
                    onChange={(e) => handleZipCodeChange(prof.id, e.target.value)}
                    className="w-24"
                    maxLength={5}
                  />
                  <Button
                    size="sm"
                    onClick={() => saveZipCode(prof.id)}
                    disabled={!zipCodes[prof.id] || zipCodes[prof.id].length !== 5}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">Default Zip Codes by City:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {Object.entries(DEFAULT_ZIPCODES).map(([city, zip]) => (
              <div key={city}>
                <span className="font-medium capitalize">{city}:</span> {zip}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
