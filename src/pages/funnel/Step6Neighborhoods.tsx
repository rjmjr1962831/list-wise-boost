import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowRight, ArrowLeft, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface Neighborhood {
  id: string;
  neighborhood: string;
  city_area_name: string;
  city_area_slug: string;
}

export default function Step6Neighborhoods() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadNeighborhoods();
  }, [token]);

  const loadNeighborhoods = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    try {
      // Get professional to verify token
      const { data: prof, error: profError } = await supabase
        .from('professionals')
        .select('id')
        .eq('verification_token', token)
        .single();

      if (profError || !prof) {
        navigate('/404');
        return;
      }

      // Get neighborhoods
      const { data: neighborhoodsData, error: neighborhoodsError } = await supabase
        .from('neighborhood_catalog')
        .select('id, neighborhood, city_area_name, city_area_slug')
        .order('city_area_name')
        .order('neighborhood');

      if (neighborhoodsError) throw neighborhoodsError;

      setNeighborhoods(neighborhoodsData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load neighborhoods');
    } finally {
      setLoading(false);
    }
  };

  const toggleNeighborhood = (id: string) => {
    const newSelected = new Set(selectedNeighborhoods);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNeighborhoods(newSelected);
  };

  const handleContinue = () => {
    toast.success(`${selectedNeighborhoods.size} neighborhoods selected!`);
    navigate(`/funnel/${token}/pricing`);
  };

  const groupedNeighborhoods = neighborhoods.reduce((acc, n) => {
    if (!acc[n.city_area_name]) {
      acc[n.city_area_name] = [];
    }
    acc[n.city_area_name].push(n);
    return acc;
  }, {} as Record<string, Neighborhood[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Select Neighborhoods | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 5 of 7</span>
                <span className="text-sm font-medium">Select Neighborhoods</span>
              </div>
              <CardTitle>Which neighborhoods are you an expert in?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Optional: Select specific neighborhoods where you have deep expertise. This will give you priority placement in those areas.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="max-h-[500px] overflow-y-auto border rounded-lg">
                {Object.entries(groupedNeighborhoods).map(([city, hoods]) => (
                  <div key={city} className="border-b last:border-b-0">
                    <div className="bg-muted/50 px-4 py-2 font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {city}
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {hoods.map((hood) => (
                        <div
                          key={hood.id}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-accent cursor-pointer"
                          onClick={() => toggleNeighborhood(hood.id)}
                        >
                          <Checkbox
                            checked={selectedNeighborhoods.has(hood.id)}
                            onCheckedChange={() => toggleNeighborhood(hood.id)}
                          />
                          <label className="cursor-pointer flex-1 text-sm">
                            {hood.neighborhood}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {selectedNeighborhoods.size > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  {selectedNeighborhoods.size} {selectedNeighborhoods.size === 1 ? 'neighborhood' : 'neighborhoods'} selected
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
