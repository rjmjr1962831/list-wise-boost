import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Wand2, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProfessionalWithoutBio {
  id: string;
  name: string;
  company: string | null;
  specialty: string[] | null;
  city_name: string;
  state: string;
  category_name: string;
}

interface GenerationResult {
  id: string;
  name: string;
  bio?: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export const BioGenerator = () => {
  const [professionals, setProfessionals] = useState<ProfessionalWithoutBio[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);

  useEffect(() => {
    fetchProfessionalsWithoutBios();
  }, []);

  const fetchProfessionalsWithoutBios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          company,
          specialty,
          description,
          cities (name, state),
          categories (plural_name)
        `)
        .eq('active', true)
        .or('description.is.null,description.eq.')
        .order('name');

      if (error) throw error;

      const formatted = (data || []).map((prof: any) => ({
        id: prof.id,
        name: prof.name,
        company: prof.company,
        specialty: prof.specialty,
        city_name: prof.cities?.name || 'Unknown',
        state: prof.cities?.state || '',
        category_name: prof.categories?.plural_name || 'Professional'
      }));

      setProfessionals(formatted);
    } catch (error: any) {
      console.error('Error fetching professionals:', error);
      toast.error('Failed to load professionals');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === professionals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(professionals.map(p => p.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleGenerateBios = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one professional');
      return;
    }

    setGenerating(true);
    setResults([]);

    try {
      toast.loading('Generating bios with AI...', { id: 'bio-generation' });

      const { data, error } = await supabase.functions.invoke('generate-agent-bios', {
        body: {
          professional_ids: Array.from(selectedIds)
        }
      });

      if (error) throw error;

      setResults(data.results);
      
      toast.success(
        `Generated ${data.summary.success.toLocaleString('en-US', { maximumFractionDigits: 0 })} bios, skipped ${data.summary.skipped.toLocaleString('en-US', { maximumFractionDigits: 0 })}, failed ${data.summary.failed.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        { id: 'bio-generation' }
      );

      // Refresh the list
      await fetchProfessionalsWithoutBios();
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error('Error generating bios:', error);
      toast.error('Failed to generate bios: ' + error.message, { id: 'bio-generation' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading professionals...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            AI Bio Generator
          </CardTitle>
          <CardDescription>
            Automatically generate professional bios for agents missing descriptions using AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedIds.size === professionals.length ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} of {professionals.length} selected
              </span>
            </div>
            <Button
              onClick={handleGenerateBios}
              disabled={selectedIds.size === 0 || generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Bios ({selectedIds.size})
                </>
              )}
            </Button>
          </div>

          <ScrollArea className="h-[400px] rounded-md border">
            <div className="p-4 space-y-2">
              {professionals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="font-semibold">All professionals have bios!</p>
                  <p className="text-sm">No agents need bio generation</p>
                </div>
              ) : (
                professionals.map((prof) => (
                  <div
                    key={prof.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.has(prof.id)}
                      onCheckedChange={() => handleToggleSelect(prof.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{prof.name}</span>
                        {prof.company && (
                          <span className="text-sm text-muted-foreground">• {prof.company}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {prof.city_name}, {prof.state}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {prof.category_name}
                        </Badge>
                        {prof.specialty && prof.specialty.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {prof.specialty.slice(0, 2).join(', ')}
                            {prof.specialty.length > 2 && ` +${prof.specialty.length - 2}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Results</CardTitle>
            <CardDescription>Review the generated bios</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className={`p-4 rounded-lg border ${
                      result.success
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                        : result.skipped
                        ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                        : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {result.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{result.name}</p>
                        {result.success && result.bio && (
                          <p className="text-sm text-muted-foreground mt-1">{result.bio}</p>
                        )}
                        {result.skipped && (
                          <p className="text-sm text-blue-600 dark:text-blue-400">Already has bio</p>
                        )}
                        {result.error && (
                          <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
