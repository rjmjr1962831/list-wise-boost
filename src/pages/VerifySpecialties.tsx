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

interface Specialty {
  id: string;
  name: string;
}

export default function VerifySpecialties() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [availableSpecialties, setAvailableSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [addingSpecialty, setAddingSpecialty] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      try {
        // Load professional
        const { data: professional, error: profError } = await supabase
          .from('professionals')
          .select('id, category_id, specialty')
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
        setCategoryId(professional.category_id);
        setSelectedSpecialties(professional.specialty || []);

        // Load available specialties
        const { data: specialties, error: specError } = await supabase
          .from('specialties')
          .select('id, name')
          .eq('category_id', professional.category_id)
          .eq('active', true)
          .order('name');

        if (specError) throw specError;
        setAvailableSpecialties(specialties || []);
      } catch (err) {
        toast({
          title: 'Error',
          description: 'Failed to load specialties',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, navigate, toast]);

  const handleAddSpecialty = async () => {
    if (!newSpecialty.trim() || !categoryId) return;

    setAddingSpecialty(true);

    try {
      // Check if specialty already exists
      const { data: existing } = await supabase
        .from('specialties')
        .select('id, name')
        .eq('name', newSpecialty.trim())
        .eq('category_id', categoryId)
        .single();

      if (existing) {
        // Add existing specialty to selection
        if (!selectedSpecialties.includes(existing.name)) {
          setSelectedSpecialties([...selectedSpecialties, existing.name]);
        }
      } else {
        // Create new specialty
        const { data: newSpec, error } = await supabase
          .from('specialties')
          .insert({
            name: newSpecialty.trim(),
            category_id: categoryId
          })
          .select()
          .single();

        if (error) throw error;

        setAvailableSpecialties([...availableSpecialties, newSpec]);
        setSelectedSpecialties([...selectedSpecialties, newSpec.name]);
      }

      setNewSpecialty('');
      toast({
        title: 'Success',
        description: 'Specialty added'
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to add specialty',
        variant: 'destructive'
      });
    } finally {
      setAddingSpecialty(false);
    }
  };

  const toggleSpecialty = (name: string) => {
    if (selectedSpecialties.includes(name)) {
      setSelectedSpecialties(selectedSpecialties.filter(s => s !== name));
    } else {
      setSelectedSpecialties([...selectedSpecialties, name]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!professionalId) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('professionals')
        .update({ specialty: selectedSpecialties })
        .eq('id', professionalId);

      if (error) throw error;

      navigate(`/verify/${token}/cities`);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to save specialties',
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
              <span>Step 2 of 3</span>
              <span>Select Specialties</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '66%' }}></div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Specialties</CardTitle>
              <CardDescription>
                Select all specialties that apply to your practice
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Available Specialties */}
                <div className="space-y-3">
                  <Label>Available Specialties</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableSpecialties.map((specialty) => (
                      <Badge
                        key={specialty.id}
                        variant={selectedSpecialties.includes(specialty.name) ? 'default' : 'outline'}
                        className="cursor-pointer px-4 py-2 text-sm"
                        onClick={() => toggleSpecialty(specialty.name)}
                      >
                        {specialty.name}
                        {selectedSpecialties.includes(specialty.name) && (
                          <X className="ml-2 h-3 w-3" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Add New Specialty */}
                <div className="space-y-2">
                  <Label htmlFor="newSpecialty">Add Custom Specialty</Label>
                  <div className="flex gap-2">
                    <Input
                      id="newSpecialty"
                      type="text"
                      value={newSpecialty}
                      onChange={(e) => setNewSpecialty(e.target.value)}
                      placeholder="Enter a new specialty"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSpecialty();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleAddSpecialty}
                      disabled={!newSpecialty.trim() || addingSpecialty}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add specialties that aren't in the list above
                  </p>
                </div>

                {/* Selected Specialties Preview */}
                {selectedSpecialties.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Specialties ({selectedSpecialties.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedSpecialties.map((name) => (
                        <Badge key={name} variant="secondary">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/verify/${token}/details`)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button type="submit" disabled={saving || selectedSpecialties.length === 0}>
                    {saving ? 'Saving...' : 'Continue'}
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
