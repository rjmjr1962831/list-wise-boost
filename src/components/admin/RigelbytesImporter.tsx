import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface City {
  id: string;
  name: string;
  state: string;
}

interface Category {
  id: string;
  name: string;
}

export function RigelbytesImporter() {
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [zipCodes, setZipCodes] = useState<string>('');
  const [detailedProfiles, setDetailedProfiles] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchCitiesAndCategories();
  }, []);

  const fetchCitiesAndCategories = async () => {
    const { data: citiesData } = await supabase
      .from('cities')
      .select('*')
      .eq('active', true)
      .order('state, name');

    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('name');

    if (citiesData) setCities(citiesData);
    if (categoriesData) setCategories(categoriesData);
  };

  const handleImport = async () => {
    if (!selectedCityId || !selectedCategoryId || !zipCodes.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    // Parse zip codes from comma-separated or space-separated input
    const zipCodesArray = zipCodes
      .split(/[,\s]+/)
      .map(zip => zip.trim())
      .filter(zip => zip.length > 0);

    if (zipCodesArray.length === 0) {
      toast.error('Please enter at least one zip code');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-rigelbytes-agents', {
        body: {
          zipCodes: zipCodesArray,
          cityId: selectedCityId,
          categoryId: selectedCategoryId,
          detailedProfiles,
        },
      });

      if (error) throw error;

      toast.success(`Successfully imported ${data.imported} out of ${data.total} agents`);
      
      // Reset form
      setZipCodes('');
      setSelectedCityId('');
      setSelectedCategoryId('');
      setDetailedProfiles(true);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import agents');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Import Agents from Rigelbytes</h2>
      <p className="text-muted-foreground mb-6">
        Import real estate agents from Zillow using the rigelbytes scraper (searches by zip code)
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Select value={selectedCityId} onValueChange={setSelectedCityId}>
            <SelectTrigger id="city">
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}, {city.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="zipCodes">Zip Codes</Label>
          <Input
            id="zipCodes"
            placeholder="e.g., 72076, 72032, 72202"
            value={zipCodes}
            onChange={(e) => setZipCodes(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter one or more zip codes separated by commas or spaces
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="detailedProfiles"
            checked={detailedProfiles}
            onCheckedChange={(checked) => setDetailedProfiles(checked as boolean)}
          />
          <Label htmlFor="detailedProfiles" className="text-sm font-normal cursor-pointer">
            Fetch detailed profiles (slower but more complete data)
          </Label>
        </div>

        <Button 
          onClick={handleImport} 
          disabled={isLoading || !selectedCityId || !selectedCategoryId || !zipCodes.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing agents (this may take several minutes)...
            </>
          ) : (
            'Import Agents'
          )}
        </Button>
      </div>
    </Card>
  );
}
