import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface City {
  id: string;
  name: string;
  slug: string;
  state: string;
}

export default function Step5Cities() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    try {
      // Get professional
      const { data: prof, error: profError } = await supabase
        .from('professionals')
        .select('id')
        .eq('verification_token', token)
        .single();

      if (profError || !prof) {
        navigate('/404');
        return;
      }

      setProfessionalId(prof.id);

      // Get cities
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('id, name, slug, state')
        .order('name');

      if (citiesError) throw citiesError;

      setCities(citiesData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load cities');
    } finally {
      setLoading(false);
    }
  };

  const toggleCity = (cityId: string) => {
    const newSelected = new Set(selectedCities);
    if (newSelected.has(cityId)) {
      newSelected.delete(cityId);
    } else {
      newSelected.add(cityId);
    }
    setSelectedCities(newSelected);
  };

  const handleContinue = () => {
    if (selectedCities.size === 0) {
      toast.error('Please select at least one city');
      return;
    }

    toast.success(`${selectedCities.size} cities selected!`);
    navigate(`/funnel/${token}/neighborhoods`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Select Cities | Top10Lists.us</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 4 of 7</span>
                <span className="text-sm font-medium">Select Cities</span>
              </div>
              <CardTitle>Which cities do you serve?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select all the cities where you help clients. You can select multiple.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto p-4 border rounded-lg">
                {cities.map((city) => (
                  <div
                    key={city.id}
                    className="flex items-center space-x-2 p-3 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => toggleCity(city.id)}
                  >
                    <Checkbox
                      checked={selectedCities.has(city.id)}
                      onCheckedChange={() => toggleCity(city.id)}
                    />
                    <label className="cursor-pointer flex-1">
                      {city.name}, {city.state}
                    </label>
                  </div>
                ))}
              </div>

              {selectedCities.size > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  {selectedCities.size} {selectedCities.size === 1 ? 'city' : 'cities'} selected
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/funnel/${token}/review-final`)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={selectedCities.size === 0}
                  className="flex-1 gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
