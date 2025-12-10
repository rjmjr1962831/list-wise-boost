import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronDown, MapPin, AlertCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface City {
  id: string;
  city_name: string;
  tier_name: string;
  brandBuilderCount: number;
}

// Premium cities that are not eligible for free listing
const PREMIUM_CITY_NAMES = [
  'Scottsdale',
  'Paradise Valley',
  'Carefree',
  'Cave Creek',
  'Sedona'
];

export default function FreeCitySelection() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [showWaitlistDialog, setShowWaitlistDialog] = useState(false);
  const [soldOutCity, setSoldOutCity] = useState<City | null>(null);
  const [professional, setProfessional] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      try {
        // Fetch professional
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        
        let { data: profData } = await supabase
          .from('professionals')
          .select('id, name, city_id')
          .eq('verification_token', token)
          .maybeSingle();

        if (!profData && isUUID) {
          const fallback = await supabase
            .from('professionals')
            .select('id, name, city_id')
            .eq('id', token)
            .maybeSingle();
          profData = fallback.data;
        }

        if (!profData) {
          navigate('/');
          return;
        }

        setProfessional(profData);

        // Fetch cities from the cities table (which professionals.city_id references)
        const { data: citiesData, error: citiesError } = await supabase
          .from('cities')
          .select('id, name, slug')
          .eq('active', true)
          .order('name');

        if (citiesError) {
          console.error('Error fetching cities:', citiesError);
          return;
        }

        // Get brand builder counts per city
        const { data: brandBuilderCounts } = await supabase
          .from('professionals')
          .select('city_id')
          .eq('is_brand_builder', true)
          .eq('active', true);

        const countMap: Record<string, number> = {};
        brandBuilderCounts?.forEach(p => {
          countMap[p.city_id] = (countMap[p.city_id] || 0) + 1;
        });

        // Filter out premium cities and add counts
        const eligibleCities = citiesData
          ?.filter(city => !PREMIUM_CITY_NAMES.includes(city.name))
          .map(city => ({
            id: city.id,
            city_name: city.name,
            tier_name: 'Standard',
            brandBuilderCount: countMap[city.id] || 0
          })) || [];

        setCities(eligibleCities);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, navigate]);

  const handleCitySelect = (cityId: string) => {
    const city = cities.find(c => c.id === cityId);
    if (!city) return;

    // Check if city has 10 brand builders (sold out)
    if (city.brandBuilderCount >= 10) {
      setSoldOutCity(city);
      setShowWaitlistDialog(true);
      return;
    }

    setSelectedCityId(cityId);
    setSelectedCity(city);
  };

  const handleJoinWaitlist = async () => {
    // TODO: Implement waitlist functionality
    toast({
      title: "Added to waitlist",
      description: `You've been added to the waitlist for ${soldOutCity?.city_name}. We'll notify you when a spot opens up.`,
    });
    setShowWaitlistDialog(false);
    setSoldOutCity(null);
  };

  const handleSelect = async () => {
    if (!selectedCityId || !professional) return;

    try {
      // Update the professional's city
      const { error } = await supabase
        .from('professionals')
        .update({ city_id: selectedCityId })
        .eq('id', professional.id);

      if (error) {
        console.error('Error updating city:', error);
        toast({
          title: "Error",
          description: "Failed to save your city selection. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Navigate to pricing/upsell page
      navigate(`/profile/${token}/pricing`);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Select Your City | Top10Lists</title>
        <meta name="description" content="Choose your free listing city" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* How It Works Section */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <h1 className="text-2xl font-bold">Here's how it works.</h1>
              
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Your free listing will appear in <strong className="text-foreground">one city</strong> on a round-robin basis with other qualified agents.
                </p>
                
                <p>
                  The premium cities of <strong className="text-foreground">{PREMIUM_CITY_NAMES.join(', ')}</strong> are not eligible for a free listing.
                </p>
                
                <p>
                  To get <strong className="text-foreground">guaranteed placement</strong> in one or more cities, you have the option to buy the spot on that city's list on the next page.
                </p>
                
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <p className="text-foreground font-medium">
                    🎉 We are offering early adopter pricing that is <strong>half price for 2 years</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* City Selection */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Pick a city for your free listing.
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose from major Arizona cities (excluding premium markets).
                </p>
              </div>

              <Select value={selectedCityId} onValueChange={handleCitySelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a city..." />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  {cities.map(city => (
                    <SelectItem 
                      key={city.id} 
                      value={city.id}
                      className="cursor-pointer"
                    >
                      <span className="flex items-center justify-between w-full">
                        <span>{city.city_name}</span>
                        {city.brandBuilderCount >= 10 && (
                          <span className="text-yellow-600 text-xs ml-2">(Sold Out)</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCity && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm">
                    <strong>{selectedCity.city_name}</strong> - {selectedCity.tier_name} tier
                  </p>
                </div>
              )}

              <Button
                size="lg"
                className="w-full"
                disabled={!selectedCity}
                onClick={handleSelect}
              >
                Select
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Waitlist Dialog */}
      <Dialog open={showWaitlistDialog} onOpenChange={setShowWaitlistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Sorry, {soldOutCity?.city_name} is sold out.
            </DialogTitle>
            <DialogDescription>
              All 10 premium spots in {soldOutCity?.city_name} have been claimed. Would you like to join our waiting list? We'll notify you when a spot becomes available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setShowWaitlistDialog(false);
              setSoldOutCity(null);
            }}>
              Pick Another City
            </Button>
            <Button onClick={handleJoinWaitlist}>
              Join Waiting List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
