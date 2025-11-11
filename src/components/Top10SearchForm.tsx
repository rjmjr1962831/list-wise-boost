import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  plural_name: string;
  slug: string;
}

interface City {
  id: string;
  name: string;
  state: string;
  state_slug: string;
  slug: string;
}

export const Top10SearchForm = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filteredCities, setFilteredCities] = useState<City[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (!categoriesError && categoriesData) {
        setCategories(categoriesData);
      }

      // Fetch cities
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .eq('active', true)
        .order('state, name');
      
      if (!citiesError && citiesData) {
        setCities(citiesData);
        // Extract unique states
        const uniqueStates = Array.from(new Set(citiesData.map(city => city.state))).sort();
        setStates(uniqueStates);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (selectedState) {
      const filtered = cities.filter(city => city.state === selectedState);
      setFilteredCities(filtered);
      setSelectedCity(''); // Reset city when state changes
    } else {
      setFilteredCities([]);
    }
  }, [selectedState, cities]);

  const handleSearch = () => {
    if (!selectedState || !selectedCity || !selectedCategory) {
      toast.error('Please select state, city, and category');
      return;
    }

    const city = cities.find(c => c.id === selectedCity);
    const category = categories.find(c => c.id === selectedCategory);

    if (city && category) {
      // Navigate to the list page
      const url = `/${city.state_slug}/${city.slug}/${category.slug}`;
      navigate(url);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Want to find a top10?</h3>
      </div>
      
      <div className="grid md:grid-cols-4 gap-4">
        <Select value={selectedState} onValueChange={setSelectedState}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select State" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {states.map(state => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={selectedCity} 
          onValueChange={setSelectedCity}
          disabled={!selectedState}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select City" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {filteredCities.map(city => (
              <SelectItem key={city.id} value={city.id}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select Category" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {categories.map(category => (
              <SelectItem key={category.id} value={category.id}>
                {category.plural_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          onClick={handleSearch} 
          className="w-full"
          disabled={!selectedState || !selectedCity || !selectedCategory}
        >
          <Search className="h-4 w-4 mr-2" />
          Find Top 10
        </Button>
      </div>
    </div>
  );
};
