import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";

export const ZuidExtractor = () => {
  const [zillowUrl, setZillowUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [professionalId, setProfessionalId] = useState("");

  const extractZuid = async () => {
    if (!zillowUrl || !professionalId) {
      toast.error("Please provide both Zillow URL and Professional ID");
      return;
    }

    setExtracting(true);

    try {
      // Extract ZUID from URL patterns like:
      // https://www.zillow.com/profile/AgentName
      // https://www.zillow.com/profile/AgentName/
      // The ZUID is the last part of the path
      
      let zuid = "";
      const url = new URL(zillowUrl);
      const pathParts = url.pathname.split('/').filter(p => p);
      
      // Check if it's a profile URL
      if (pathParts[0] === 'profile' && pathParts[1]) {
        zuid = pathParts[1];
      } else {
        toast.error("Invalid Zillow profile URL format. Expected: zillow.com/profile/ZUID");
        setExtracting(false);
        return;
      }

      console.log('Extracted ZUID:', zuid);

      // Update the professional record
      const { error: updateError } = await supabase
        .from('professionals')
        .update({ zuid })
        .eq('id', professionalId);

      if (updateError) throw updateError;

      toast.success(`ZUID extracted and saved: ${zuid}`);
      setZillowUrl("");
      setProfessionalId("");
    } catch (error: any) {
      console.error('Error extracting ZUID:', error);
      toast.error(error.message || 'Failed to extract ZUID');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ZUID Extractor</CardTitle>
        <CardDescription>
          Extract Zillow User ID (ZUID) from agent profile URLs and save to database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="professionalId">Professional ID</Label>
          <Input
            id="professionalId"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            placeholder="Enter professional UUID from database"
          />
          <p className="text-xs text-muted-foreground">
            Find the UUID in the Professionals Manager table
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zillowUrl">Zillow Profile URL</Label>
          <Input
            id="zillowUrl"
            value={zillowUrl}
            onChange={(e) => setZillowUrl(e.target.value)}
            placeholder="https://www.zillow.com/profile/AgentName"
          />
          <p className="text-xs text-muted-foreground">
            Example: https://www.zillow.com/profile/ShawnRogers1
          </p>
        </div>

        <Button 
          onClick={extractZuid} 
          disabled={extracting || !zillowUrl || !professionalId}
          className="w-full"
        >
          {extracting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              Extract ZUID
            </>
          )}
        </Button>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold mb-2">How to find Zillow Profile URLs:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Search for the agent on Zillow.com</li>
            <li>Click on their profile</li>
            <li>Copy the URL from the browser (format: zillow.com/profile/USERNAME)</li>
            <li>The ZUID is the username part after /profile/</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
