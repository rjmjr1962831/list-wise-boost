import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Image } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface City {
  id: string;
  name: string;
  state: string;
}

interface Category {
  id: string;
  name: string;
}

export function PhotoGenerator() {
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
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

  const handleGeneratePhotos = async () => {
    if (!selectedCityId || !selectedCategoryId) {
      toast.error('Please select both city and category');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-generate-photos', {
        body: {
          cityId: selectedCityId,
          categoryId: selectedCategoryId,
        },
      });

      if (error) throw error;

      toast.success(`Successfully generated ${data.generated} out of ${data.total} photos`);
      
    } catch (error: any) {
      console.error('Photo generation error:', error);
      toast.error(error.message || 'Failed to generate photos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Image className="h-6 w-6" />
        <h2 className="text-2xl font-bold">AI Photo Generator</h2>
      </div>
      <p className="text-muted-foreground mb-6">
        Generate professional AI headshots for agents without profile photos
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

        <Button 
          onClick={handleGeneratePhotos} 
          disabled={isLoading || !selectedCityId || !selectedCategoryId}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating photos...
            </>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              Generate AI Photos
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          This will generate professional headshots for all agents in the selected city/category that don't have photos yet.
        </p>
      </div>
    </Card>
  );
}
