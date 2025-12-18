import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { OnboardingData } from '@/pages/AgentOnboarding';
import { supabase } from '@/integrations/supabase/client';
import { ContactSupportBanner } from './ContactSupportBanner';

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
  const [suggestions, setSuggestions] = useState<string[]>([]);

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

  const handleSpecialtyInputChange = (value: string) => {
    setNewSpecialty(value);
    
    if (value.trim()) {
      // Find case-insensitive matches
      const matches = availableSpecialties.filter(specialty =>
        specialty.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (specialty: string) => {
    toggleSpecialty(specialty);
    setNewSpecialty('');
    setSuggestions([]);
  };

  const addCustomSpecialty = async () => {
    if (!newSpecialty.trim()) return;

    const specialty = newSpecialty.trim();
    
    // Check if already exists (case-insensitive)
    const existingMatch = availableSpecialties.find(
      s => s.toLowerCase() === specialty.toLowerCase()
    );
    
    if (existingMatch) {
      toggleSpecialty(existingMatch);
      setNewSpecialty('');
      setSuggestions([]);
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
      setSuggestions([]);
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
      <ContactSupportBanner />
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
          <div className="space-y-2 relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={newSpecialty}
                  onChange={(e) => handleSpecialtyInputChange(e.target.value)}
                  placeholder="Type to search or add specialty..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomSpecialty();
                    }
                  }}
                />
                
                {/* Autocomplete Suggestions */}
                {suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => selectSuggestion(suggestion)}
                        className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center justify-between group"
                      >
                        <span>{suggestion}</span>
                        <Badge 
                          variant={data.specialties?.includes(suggestion) ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {data.specialties?.includes(suggestion) ? 'Selected' : 'Select'}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
              {suggestions.length > 0 
                ? 'Click a suggestion to select, or press Enter to add as new' 
                : 'Type to search existing specialties or add a new one'}
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
