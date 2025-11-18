import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export function DataWizardsImporter() {
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [itemLimit, setItemLimit] = useState<number>(50);
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
    if (!selectedCityId || !selectedCategoryId || !searchQuery) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-datawizards-agents', {
        body: {
          searchQuery,
          cityId: selectedCityId,
          categoryId: selectedCategoryId,
          itemLimit,
        },
      });

      if (error) throw error;

      toast.success(`Successfully imported ${data.imported} out of ${data.total} agents`);
      
      // Reset form
      setSearchQuery('');
      setSelectedCityId('');
      setSelectedCategoryId('');
      setItemLimit(50);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import agents');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Import Agents from DataWizards</h2>
      <p className="text-muted-foreground mb-6">
        Import real estate agents from Zillow using the DataWizards scraper
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
          <Label htmlFor="searchQuery">Search Query</Label>
          <Input
            id="searchQuery"
            placeholder="e.g., chandler, az or texas"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Location to search on Zillow (city, state or just state)
          </p>
        </div>

        <div>
          <Label htmlFor="itemLimit">Item Limit</Label>
          <Input
            id="itemLimit"
            type="number"
            min="1"
            max="200"
            value={itemLimit}
            onChange={(e) => setItemLimit(parseInt(e.target.value) || 50)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Maximum number of agents to import (1-200)
          </p>
        </div>

        <Button 
          onClick={handleImport} 
          disabled={isLoading || !selectedCityId || !selectedCategoryId || !searchQuery}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing agents...
            </>
          ) : (
            'Import Agents'
          )}
        </Button>
      </div>
    </Card>
  );
}
