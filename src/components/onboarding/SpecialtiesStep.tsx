import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { OnboardingData } from '@/pages/AgentOnboarding';
import { supabase } from '@/integrations/supabase/client';

interface SpecialtiesStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function SpecialtiesStep({ data, updateData, onNext, onBack }: SpecialtiesStepProps) {
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    try {
      const { data: specialtiesData, error } = await supabase
        .from('specialties')
        .select('name')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      const names = specialtiesData?.map((s) => s.name) || [];
      setAvailableSpecialties(names);
    } catch (error) {
      console.error('Error fetching specialties:', error);
      toast.error('Failed to load specialties');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    const current = data.specialties || [];
    if (current.includes(specialty)) {
      updateData({ specialties: current.filter((s) => s !== specialty) });
    } else {
      updateData({ specialties: [...current, specialty] });
    }
  };

  const addCustomSpecialty = async () => {
    if (!newSpecialty.trim()) return;

    const specialty = newSpecialty.trim();
    
    // Check if already exists
    if (availableSpecialties.includes(specialty)) {
      toggleSpecialty(specialty);
      setNewSpecialty('');
      return;
    }

    try {
      // Add to database
      const { error } = await supabase
        .from('specialties')
        .insert({ name: specialty, active: true });

      if (error && !error.message.includes('duplicate')) throw error;

      // Add to local state
      setAvailableSpecialties([...availableSpecialties, specialty].sort());
      toggleSpecialty(specialty);
      setNewSpecialty('');
      toast.success('Specialty added!');
    } catch (error) {
      console.error('Error adding specialty:', error);
      toast.error('Failed to add specialty');
    }
  };

  const handleNext = () => {
    if ((data.specialties?.length || 0) === 0) {
      toast.error('Required: Please select at least one specialty', {
        description: 'Choose from the list or add your own custom specialty',
        duration: 5000,
      });
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <Card>
        <CardHeader>
          <CardTitle>What are your specialties?</CardTitle>
          <CardDescription>
            Select all that apply. You can add custom specialties if needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selected Count */}
          <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
            <span className="text-sm font-medium">
              Selected Specialties
            </span>
            <Badge variant="secondary">
              {data.specialties?.length || 0}
            </Badge>
          </div>

          {/* Available Specialties */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading specialties...
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableSpecialties.map((specialty) => {
                const isSelected = data.specialties?.includes(specialty);
                return (
                  <Badge
                    key={specialty}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer hover:opacity-80 transition-opacity px-3 py-1.5"
                    onClick={() => toggleSpecialty(specialty)}
                  >
                    {specialty}
                    {isSelected && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Add Custom Specialty */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                placeholder="Add custom specialty..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSpecialty();
                  }
                }}
              />
              <Button
                type="button"
                onClick={addCustomSpecialty}
                disabled={!newSpecialty.trim()}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or click Add to include a custom specialty
            </p>
          </div>

          {/* Selected Specialties Display */}
          {(data.specialties?.length || 0) > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Your Selected Specialties:</h4>
              <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border border-border/50">
                {data.specialties.map((specialty) => (
                  <Badge
                    key={specialty}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => toggleSpecialty(specialty)}
                  >
                    {specialty}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          Back
        </Button>
        <Button onClick={handleNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
