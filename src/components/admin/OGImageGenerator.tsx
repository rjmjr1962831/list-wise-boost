import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Image, CheckCircle2, XCircle, Search, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const OGImageGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [successful, setSuccessful] = useState(0);
  const [failed, setFailed] = useState(0);
  const [onlyMissing, setOnlyMissing] = useState(true);
  
  // Preview states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Search agents query
  const { data: searchResults } = useQuery({
    queryKey: ['agent-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, city_id')
        .eq('active', true)
        .ilike('name', `%${searchQuery}%`)
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const generatePreview = async () => {
    if (!selectedAgentId) {
      toast.error('Please select an agent first');
      return;
    }

    setIsPreviewLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image?id=${selectedAgentId}`;
      
      // Include auth token to satisfy edge function JWT requirement
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate preview: ${response.statusText}`);
      }
      
      setPreviewUrl(url);
      toast.success('Preview generated successfully!');
    } catch (err) {
      console.error('Error generating preview:', err);
      toast.error('Failed to generate preview');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const generateOGImages = async () => {
    try {
      setIsGenerating(true);
      setProgress(0);
      setProcessed(0);
      setSuccessful(0);
      setFailed(0);

      // Fetch professionals
      const query = supabase
        .from('professionals')
        .select('id, name, city_id')
        .eq('active', true);

      if (onlyMissing) {
        query.is('og_image_url', null);
      }

      const { data: professionals, error } = await query;

      if (error) {
        console.error('Error fetching professionals:', error);
        toast.error('Failed to fetch professionals');
        return;
      }

      if (!professionals || professionals.length === 0) {
        toast.info(onlyMissing ? 'All agents already have OG images!' : 'No active agents found');
        return;
      }

      setTotal(professionals.length);
      toast.info(`Starting generation for ${professionals.length} agents...`);

      // Generate OG images for each professional
      for (let i = 0; i < professionals.length; i++) {
        const professional = professionals[i];
        
        try {
          // Generate the OG image URL (the edge function will generate it on-demand)
          const ogImageUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image?id=${professional.id}`;

          // Include auth token to satisfy edge function JWT requirement
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const accessToken = session?.access_token;

          // Test that the image generates successfully
          const response = await fetch(ogImageUrl, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });
          
          if (!response.ok) {
            throw new Error(`Failed to generate image: ${response.statusText}`);
          }

          // Update the professional record with the OG image URL
          const { error: updateError } = await supabase
            .from('professionals')
            .update({ og_image_url: ogImageUrl })
            .eq('id', professional.id);

          if (updateError) {
            console.error(`Error updating professional ${professional.name}:`, updateError);
            setFailed(prev => prev + 1);
          } else {
            setSuccessful(prev => prev + 1);
          }
        } catch (err) {
          console.error(`Error generating OG image for ${professional.name}:`, err);
          setFailed(prev => prev + 1);
        }

        setProcessed(prev => prev + 1);
        setProgress(((i + 1) / professionals.length) * 100);
      }

      toast.success(
        `Generation complete! ${successful} successful, ${failed} failed`
      );
    } catch (error) {
      console.error('Error in batch generation:', error);
      toast.error('An error occurred during generation');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          OG Image Generator
        </CardTitle>
        <CardDescription>
          Generate social media preview images (Open Graph images) for all agents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview Section */}
        <div className="space-y-4 pb-6 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview OG Image
          </h3>
          
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agent by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {searchResults && searchResults.length > 0 && (
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent to preview" />
                </SelectTrigger>
                <SelectContent>
                  {searchResults.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={generatePreview}
              disabled={!selectedAgentId || isPreviewLoading}
              variant="outline"
              className="w-full"
            >
              {isPreviewLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Preview...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview OG Image
                </>
              )}
            </Button>

            {previewUrl && (
              <div className="space-y-2">
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  <img
                    src={previewUrl}
                    alt="OG Image Preview"
                    className="w-full h-auto"
                    style={{ maxWidth: '600px', margin: '0 auto', display: 'block' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  {previewUrl}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Batch Generation Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Batch Generation</h3>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="only-missing"
              checked={onlyMissing}
              onCheckedChange={setOnlyMissing}
              disabled={isGenerating}
            />
            <Label htmlFor="only-missing">
              Only generate for agents without OG images
            </Label>
          </div>

        {isGenerating && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-muted-foreground text-center">
              Processing {processed} of {total}...
            </div>
            <div className="flex justify-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {successful} successful
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-4 w-4" />
                {failed} failed
              </span>
            </div>
          </div>
        )}

          <Button
            onClick={generateOGImages}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Image className="mr-2 h-4 w-4" />
                Generate OG Images for All
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground border-t pt-4 space-y-1">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Generates 1200x630px social preview images</li>
              <li>Includes agent photo, name, rating, specialties, and bio</li>
              <li>Images are served dynamically via Edge Function</li>
              <li>URLs are stored in the database for quick access</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
