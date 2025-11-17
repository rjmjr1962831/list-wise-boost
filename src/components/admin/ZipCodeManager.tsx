import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { MapPin, Save, Search } from 'lucide-react';
import { getDefaultZipForCity, getZipCodesByCity } from '@/data/zipCodeLookup';

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
    // Use the new zip code lookup to get default zip for this city
    const city = cities.find(c => c.id === selectedCity);
    if (city) {
      return getDefaultZipForCity(city.name, city.state);
    }
    return null;
  };

  const autoFillZipCodes = () => {
    const city = cities.find(c => c.id === selectedCity);
    const defaultZip = city ? getDefaultZipForCity(city.name, city.state) : null;

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
          <h4 className="font-semibold mb-2">Available Zip Codes for Selected City:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {selectedCity && cities.find(c => c.id === selectedCity) && (() => {
              const city = cities.find(c => c.id === selectedCity)!;
              const cityZips = getZipCodesByCity(city.name, city.state);
              return cityZips.map((record) => (
                <div key={record.zipcode} className="flex flex-col">
                  <span className="font-medium">{record.zipcode}</span>
                  <span className="text-xs text-muted-foreground">Value: {record.agent_value}/5</span>
                  <span className="text-xs text-muted-foreground">${(parseInt(record.median_income) / 1000).toFixed(0)}k income</span>
                </div>
              ));
            })()}
            {!selectedCity && (
              <p className="text-muted-foreground col-span-full">Select a city to see available zip codes</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
