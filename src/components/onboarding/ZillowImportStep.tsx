import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, AlertCircle } from "lucide-react";
import { ContactSupportBanner } from "./ContactSupportBanner";

interface ZillowImportStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const ZillowImportStep = ({ data, updateData, onNext, onBack }: ZillowImportStepProps) => {
  const { toast } = useToast();
  const [zillowUrl, setZillowUrl] = useState(data.zillowUrl || "");
  const [importing, setImporting] = useState(false);
  const [canSkip, setCanSkip] = useState(false);

  const validateZillowUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('zillow.com') && url.includes('/profile/');
    } catch {
      return false;
    }
  };

  const handleImport = async () => {
    if (!zillowUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Zillow profile URL",
        variant: "destructive",
      });
      return;
    }

    if (!validateZillowUrl(zillowUrl)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Zillow agent profile URL (e.g., https://www.zillow.com/profile/agent-name)",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      // Use Firecrawl-based edge function instead of deprecated memo23/Apify
      const { data: functionData, error } = await supabase.functions.invoke('fetch-zillow-agent-firecrawl', {
        body: { 
          url: zillowUrl
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to fetch Zillow data');
      }

      if (!functionData || functionData.error) {
        throw new Error(functionData?.error || 'No data returned from Zillow');
      }

      // Extract data from Firecrawl response
      const zillowData = functionData.data || functionData;
      
      updateData({
        zillowUrl: zillowUrl,
        fullName: zillowData.name || data.fullName,
        brokerageName: zillowData.brokerage || zillowData.company || data.brokerageName,
        phone: zillowData.phone || data.phone,
        website: zillowData.website || data.website,
        yearsExperience: zillowData.yearsExperience || zillowData.years_experience || data.yearsExperience,
        bio: zillowData.description || zillowData.bio || data.bio,
      });

      toast({
        title: "Success!",
        description: "Your Zillow profile data has been imported successfully.",
      });

      onNext();
    } catch (error: any) {
      console.error('Error importing Zillow data:', error);
      
      setCanSkip(true);
      
      toast({
        title: "Import Failed",
        description: error.message || "We couldn't fetch your Zillow profile. You can skip this step and enter your information manually.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleSkip = () => {
    updateData({ zillowUrl: '' });
    onNext();
  };

  return (
    <div className="space-y-4">
      <ContactSupportBanner />
      <Card className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Import from Zillow</h2>
        <p className="text-muted-foreground">
          Speed up your application by importing your agent profile from Zillow. 
          We'll pre-fill your information including your name, brokerage, and experience.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label htmlFor="zillowUrl">Zillow Profile URL</Label>
          <Input
            id="zillowUrl"
            value={zillowUrl}
            onChange={(e) => setZillowUrl(e.target.value)}
            placeholder="https://www.zillow.com/profile/your-name"
            disabled={importing}
          />
          <p className="text-xs text-muted-foreground mt-2">
            To find your Zillow URL, go to your Zillow agent profile and copy the URL from your browser's address bar.
          </p>
        </div>

        {canSkip && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-900 mb-1">Import Failed</p>
              <p className="text-yellow-800">
                We couldn't fetch your Zillow profile. This might be due to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-yellow-800">
                <li>Incorrect URL format</li>
                <li>Private or restricted profile</li>
                <li>Temporary service issue</li>
              </ul>
              <p className="mt-2 text-yellow-800">
                You can skip this step and enter your information manually in the next steps.
              </p>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Why import from Zillow?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Saves time by auto-filling your profile</li>
            <li>✓ Ensures accurate information</li>
            <li>✓ Imports your professional statistics</li>
            <li>✓ You can still edit everything later</li>
          </ul>
        </div>

        <div className="flex gap-4">
          <Button onClick={onBack} variant="outline" className="flex-1">
            Back
          </Button>
          
          {canSkip ? (
            <Button onClick={handleSkip} variant="outline" className="flex-1">
              Skip & Enter Manually
            </Button>
          ) : (
            <Button onClick={handleImport} className="flex-1" disabled={importing || !zillowUrl.trim()}>
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Import from Zillow
                </>
              )}
            </Button>
          )}
        </div>

        {!canSkip && (
          <div className="text-center">
            <Button onClick={handleSkip} variant="link" className="text-muted-foreground">
              Skip this step
            </Button>
          </div>
        )}
      </div>
      </Card>
    </div>
  );
};

export default ZillowImportStep;
