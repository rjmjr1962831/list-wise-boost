import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';

interface City {
  id: string;
  name: string;
  state: string;
}

export default function VerifyCities() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [professionalState, setProfessionalState] = useState<string | null>(null);
  const [availableCities, setAvailableCities] = useState<City[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [newCityName, setNewCityName] = useState('');
  const [addingCity, setAddingCity] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      try {
        // Load professional with their city/state
        const { data: professional, error: profError } = await supabase
          .from('professionals')
          .select(`
            id,
            city_id,
            cities!inner (
              id,
              name,
              state
            )
          `)
          .eq('verification_token', token)
          .gt('verification_token_expires_at', new Date().toISOString())
          .single();

        if (profError || !professional) {
          toast({
            title: 'Error',
            description: 'Invalid or expired verification link',
            variant: 'destructive'
          });
          navigate('/');
          return;
        }

        setProfessionalId(professional.id);
        const cityData = professional.cities as unknown as City;
        setProfessionalState(cityData.state);
        setSelectedCities([cityData.id]);

        // Load all cities in the same state
        const { data: cities, error: citiesError } = await supabase
          .from('cities')
          .select('id, name, state')
          .eq('state', cityData.state)
          .eq('active', true)
          .order('name');

        if (citiesError) throw citiesError;
        setAvailableCities(cities || []);
      } catch (err) {
        toast({
          title: 'Error',
          description: 'Failed to load cities',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, navigate, toast]);

  const handleAddCity = async () => {
    if (!newCityName.trim() || !professionalState) return;

    setAddingCity(true);

    try {
      // Check if city already exists
      const { data: existing } = await supabase
        .from('cities')
        .select('id, name, state')
        .eq('name', newCityName.trim())
        .eq('state', professionalState)
        .single();

      if (existing) {
        // Add existing city to selection
        if (!selectedCities.includes(existing.id)) {
          setSelectedCities([...selectedCities, existing.id]);
        }
        toast({
          title: 'City Added',
          description: `${existing.name} added to your service areas`
        });
      } else {
        // Create new city
        const slugify = (text: string) => 
          text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        const { data: newCity, error } = await supabase
          .from('cities')
          .insert({
            name: newCityName.trim(),
            state: professionalState,
            slug: slugify(newCityName.trim()),
            state_slug: slugify(professionalState),
            active: true
          })
          .select()
          .single();

        if (error) throw error;

        setAvailableCities([...availableCities, newCity]);
        setSelectedCities([...selectedCities, newCity.id]);
        
        toast({
          title: 'Success',
          description: `${newCity.name} added to the database and your service areas`
        });
      }

      setNewCityName('');
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to add city',
        variant: 'destructive'
      });
    } finally {
      setAddingCity(false);
    }
  };

  const toggleCity = (cityId: string) => {
    if (selectedCities.includes(cityId)) {
      // Don't allow removing the last city
      if (selectedCities.length === 1) {
        toast({
          title: 'Warning',
          description: 'You must have at least one service area selected',
          variant: 'destructive'
        });
        return;
      }
      setSelectedCities(selectedCities.filter(id => id !== cityId));
    } else {
      setSelectedCities([...selectedCities, cityId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!professionalId || selectedCities.length === 0) return;

    setSaving(true);

    try {
      // For now, we'll just update the verification status
      // In a full implementation, you'd store the service areas in a junction table
      const { error } = await supabase
        .from('professionals')
        .update({ 
          verification_started_at: new Date().toISOString()
        })
        .eq('id', professionalId);

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'Your verification is complete. We will review your information shortly.',
        duration: 5000
      });

      // Navigate to next step (user will define this later)
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to complete verification',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>Step 3 of 3</span>
              <span>Service Areas</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Service Areas</CardTitle>
              <CardDescription>
                Select all cities where you provide services in {professionalState}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Available Cities */}
                <div className="space-y-3">
                  <Label>Cities in {professionalState}</Label>
                  <div className="max-h-64 overflow-y-auto border rounded-lg p-4">
                    <div className="flex flex-wrap gap-2">
                      {availableCities.map((city) => (
                        <Badge
                          key={city.id}
                          variant={selectedCities.includes(city.id) ? 'default' : 'outline'}
                          className="cursor-pointer px-4 py-2 text-sm"
                          onClick={() => toggleCity(city.id)}
                        >
                          {city.name}
                          {selectedCities.includes(city.id) && (
                            <X className="ml-2 h-3 w-3" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Add New City */}
                <div className="space-y-2">
                  <Label htmlFor="newCity">Add City Not Listed</Label>
                  <div className="flex gap-2">
                    <Input
                      id="newCity"
                      type="text"
                      value={newCityName}
                      onChange={(e) => setNewCityName(e.target.value)}
                      placeholder={`Enter city name in ${professionalState}`}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCity();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleAddCity}
                      disabled={!newCityName.trim() || addingCity}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Can't find your city? Add it and it will be available for others too
                  </p>
                </div>

                {/* Selected Cities Preview */}
                {selectedCities.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Service Areas ({selectedCities.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedCities.map((cityId) => {
                        const city = availableCities.find(c => c.id === cityId);
                        return city ? (
                          <Badge key={cityId} variant="secondary">
                            {city.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/verify/${token}/specialties`)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button type="submit" disabled={saving || selectedCities.length === 0}>
                    {saving ? 'Completing...' : 'Complete Verification'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
