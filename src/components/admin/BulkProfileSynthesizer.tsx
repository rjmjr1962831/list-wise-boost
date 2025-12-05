import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Professional {
  id: string;
  name: string;
  profile_last_synthesized_at: string | null;
  notable_achievements: any;
  press_mentions: any;
  city_id: string;
  cities?: { name: string; state: string };
}

export function BulkProfileSynthesizer() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ [key: string]: 'success' | 'error' | 'pending' }>({});
  const [onlyWithPress, setOnlyWithPress] = useState(true);

  useEffect(() => {
    fetchProfessionals();
  }, [onlyWithPress]);

  const fetchProfessionals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('professionals')
        .select('id, name, profile_last_synthesized_at, notable_achievements, press_mentions, city_id, cities(name, state)')
        .eq('active', true)
        .order('name');

      if (onlyWithPress) {
        query = query.not('press_mentions', 'eq', '[]');
      }

      const { data, error } = await query;

      if (error) throw error;

      setProfessionals(data || []);
      toast.success(`Loaded ${data?.length || 0} professionals`);
    } catch (error) {
      console.error('Error fetching professionals:', error);
      toast.error('Failed to load professionals');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === professionals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(professionals.map(p => p.id)));
    }
  };

  const handleBulkSynthesize = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one professional');
      return;
    }

    setProcessing(true);
    setProgress({ current: 0, total: selectedIds.size });
    setResults({});

    const selectedProfs = professionals.filter(p => selectedIds.has(p.id));

    for (let i = 0; i < selectedProfs.length; i++) {
      const prof = selectedProfs[i];
      setProgress({ current: i + 1, total: selectedIds.size });
      setResults(prev => ({ ...prev, [prof.id]: 'pending' }));

      try {
        // Get existing press data to use as raw research
        const rawResearch = prof.press_mentions && Array.isArray(prof.press_mentions) && prof.press_mentions.length > 0
          ? JSON.stringify(prof.press_mentions, null, 2)
          : '';

        const { data, error } = await supabase.functions.invoke('synthesize-agent-profile', {
          body: {
            professionalId: prof.id,
            rawResearch,
            skipIfNoPress: false
          }
        });

        if (error) throw error;

        if (data?.success) {
          setResults(prev => ({ ...prev, [prof.id]: 'success' }));
          toast.success(`✅ ${prof.name} - Synthesized successfully`);
        } else {
          throw new Error('Synthesis failed');
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error synthesizing ${prof.name}:`, error);
        setResults(prev => ({ ...prev, [prof.id]: 'error' }));
        toast.error(`❌ ${prof.name} - Failed to synthesize`);
      }
    }

    setProcessing(false);
    toast.success(`Completed synthesis for ${selectedIds.size} professionals`);
    
    // Refresh the list
    fetchProfessionals();
    setSelectedIds(new Set());
  };

  const getStatusIcon = (profId: string) => {
    const status = results[profId];
    if (status === 'success') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === 'pending') return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading professionals...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Bulk Profile Synthesizer
            </CardTitle>
            <CardDescription>
              Uses Gemini Flash for web search (10 iterative queries) + Claude Sonnet for ~300 word profile synthesis
            </CardDescription>
          </div>
          <Badge variant="secondary">{professionals.length} professionals</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filter Controls */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="only-press"
                checked={onlyWithPress}
                onCheckedChange={setOnlyWithPress}
              />
              <Label htmlFor="only-press">Only show profiles with press mentions</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={processing}
            >
              {selectedIds.size === professionals.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              onClick={handleBulkSynthesize}
              disabled={processing || selectedIds.size === 0}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing {progress.current}/{progress.total}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Synthesize Selected ({selectedIds.size})
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Professionals List */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {professionals.map((prof) => (
            <div
              key={prof.id}
              className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                selectedIds.has(prof.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-4 flex-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(prof.id)}
                  onChange={() => toggleSelection(prof.id)}
                  disabled={processing}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{prof.name}</p>
                    {getStatusIcon(prof.id)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-muted-foreground">
                      {prof.cities?.name}, {prof.cities?.state}
                    </p>
                    {prof.press_mentions && Array.isArray(prof.press_mentions) && prof.press_mentions.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {prof.press_mentions.length} press mentions
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {prof.profile_last_synthesized_at ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Last synthesized</p>
                      <p className="text-xs font-mono">
                        {new Date(prof.profile_last_synthesized_at).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <Badge variant="secondary">Never synthesized</Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Achievements</p>
                  <p className="text-sm font-medium">
                    {(Array.isArray(prof.notable_achievements) ? prof.notable_achievements.length : 0)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {professionals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No professionals found with the current filters</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
