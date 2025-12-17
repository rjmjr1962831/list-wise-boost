import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Link2, CheckCircle, XCircle, ExternalLink } from "lucide-react";

export function MagicLinkGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [syncToPipedrive, setSyncToPipedrive] = useState(true);
  const [progress, setProgress] = useState<{
    total: number;
    successful: number;
    failed: number;
    errors: any[];
  } | null>(null);

  const generateAllLinks = async () => {
    try {
      setIsGenerating(true);
      setProgress(null);

      console.log('🚀 Starting bulk magic link generation...');
      
      const { data, error } = await supabase.functions.invoke('generate-all-magic-links', {
        body: { 
          sync_to_pipedrive: syncToPipedrive 
        }
      });

      if (error) throw error;

      if (data.success) {
        setProgress(data.results);
        toast({
          title: "Magic Links Generated!",
          description: `Successfully created ${data.results.successful} links${syncToPipedrive ? ' and synced to Pipedrive' : ''}`,
        });
      } else {
        throw new Error(data.error || 'Failed to generate links');
      }

    } catch (error: any) {
      console.error('Error generating magic links:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate magic links",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyErrorsToClipboard = () => {
    if (!progress?.errors.length) return;
    
    const errorText = progress.errors
      .map(e => `${e.name}: ${e.error}`)
      .join('\n');
    
    navigator.clipboard.writeText(errorText);
    toast({
      title: "Copied to clipboard",
      description: "Error details copied to clipboard",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Magic Link Generator
        </CardTitle>
        <CardDescription>
          Generate permanent magic links for all active professionals without links.
          Links are stored in the database and can be synced to Pipedrive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sync to Pipedrive Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sync-pipedrive">Sync to Pipedrive</Label>
            <p className="text-sm text-muted-foreground">
              Automatically update the Magic Link field in Pipedrive
            </p>
          </div>
          <Switch
            id="sync-pipedrive"
            checked={syncToPipedrive}
            onCheckedChange={setSyncToPipedrive}
            disabled={isGenerating}
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateAllLinks}
          disabled={isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating Links...
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4 mr-2" />
              Generate All Magic Links
            </>
          )}
        </Button>

        {/* Progress Display */}
        {progress && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Generation Complete</span>
              <span className="text-muted-foreground">
                {progress.successful + progress.failed} / {progress.total}
              </span>
            </div>

            <Progress 
              value={((progress.successful + progress.failed) / progress.total) * 100} 
              className="h-2"
            />

            {/* Results Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">{progress.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              
              <div className="text-center p-3 rounded-lg bg-success/10">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-success">
                  <CheckCircle className="w-5 h-5" />
                  {progress.successful}
                </div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              
              <div className="text-center p-3 rounded-lg bg-destructive/10">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-destructive">
                  <XCircle className="w-5 h-5" />
                  {progress.failed}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Success Rate Badge */}
            <div className="flex items-center justify-center gap-2">
              <Badge variant={progress.failed === 0 ? "default" : "secondary"}>
                {((progress.successful / progress.total) * 100).toFixed(1)}% Success Rate
              </Badge>
              {syncToPipedrive && (
                <Badge variant="outline" className="gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Synced to Pipedrive
                </Badge>
              )}
            </div>

            {/* Errors List */}
            {progress.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-destructive">
                    Errors ({progress.errors.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyErrorsToClipboard}
                  >
                    Copy Errors
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border p-3">
                  {progress.errors.map((error, idx) => (
                    <div key={idx} className="text-xs space-y-1">
                      <div className="font-medium text-foreground">{error.name}</div>
                      <div className="text-muted-foreground">{error.error}</div>
                      {idx < progress.errors.length - 1 && <div className="border-t my-2" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg space-y-2">
          <div className="font-medium text-foreground">How it works:</div>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Generates permanent tokens (expires 2099) for active professionals without magic links</li>
            <li>Creates URLs: <code className="text-xs bg-background px-1 py-0.5 rounded">https://top10lists.us/arizona/{'{city}'}/{'{name}'}-{'{phone}'}</code></li>
            <li>Rate limited to 500ms between generations to protect API</li>
            <li>Optionally syncs magic links to Pipedrive custom field</li>
            <li>Tokens are stored in verification_token column</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
