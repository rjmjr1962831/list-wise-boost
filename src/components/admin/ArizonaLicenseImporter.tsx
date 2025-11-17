import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

export const ArizonaLicenseImporter = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, matched: 0, updated: 0 });

  const normalizeName = (name: string) => {
    return name.toLowerCase().trim().replace(/[^a-z\s]/g, '');
  };

  const calculateYearsExperience = (issueDate: string): number => {
    const date = new Date(issueDate);
    const today = new Date();
    const years = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.round(years);
  };

  const formatAddress = (addr1: string, addr2: string, city: string, state: string, zip: string) => {
    const parts = [addr1, addr2, city, state, zip].filter(p => p && p.trim());
    return parts.join(', ');
  };

  const processLicenses = async () => {
    setIsProcessing(true);
    setProgress({ current: 0, total: 0, matched: 0, updated: 0 });

    try {
      // Fetch Arizona professionals
      const { data: professionals, error: profError } = await supabase
        .from('professionals')
        .select('id, name, cities!inner(state)')
        .eq('cities.state', 'Arizona')
        .eq('active', true);

      if (profError) throw profError;

      if (!professionals || professionals.length === 0) {
        toast.info('No Arizona professionals found in database');
        return;
      }

      setProgress(prev => ({ ...prev, total: professionals.length }));

      // Fetch CSV data
      const response = await fetch('/arizona-licenses.csv');
      const csvText = await response.text();
      const lines = csvText.split('\n');
      const headers = lines[0].split(',');

      // Parse CSV into lookup map (new format with LicNumber column)
      const licenseMap = new Map();
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');
        if (values.length < 13) continue;

        const lastName = values[0]?.replace(/"/g, '').trim();
        const firstName = values[1]?.replace(/"/g, '').trim();
        const middleName = values[2]?.replace(/"/g, '').trim();
        const fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
        const normalizedName = normalizeName(fullName);

        const issueDate = values[3]?.replace(/"/g, '').trim();
        const licNumber = values[4]?.replace(/"/g, '').trim(); // Actual license number
        const phone = values[7]?.replace(/"/g, '').trim();
        const addr1 = values[8]?.replace(/"/g, '').trim();
        const addr2 = values[9]?.replace(/"/g, '').trim();
        const city = values[10]?.replace(/"/g, '').trim();
        const state = values[11]?.replace(/"/g, '').trim();
        const zip = values[12]?.replace(/"/g, '').trim();

        licenseMap.set(normalizedName, {
          licenseNumber: licNumber,
          issueDate,
          phone,
          address: formatAddress(addr1, addr2, city, state, zip),
          yearsExperience: calculateYearsExperience(issueDate)
        });
      }

      // Match and update professionals
      let matched = 0;
      let updated = 0;

      for (let i = 0; i < professionals.length; i++) {
        const prof = professionals[i];
        const normalizedProfName = normalizeName(prof.name);

        setProgress(prev => ({ ...prev, current: i + 1 }));

        const licenseData = licenseMap.get(normalizedProfName);
        if (licenseData) {
          matched++;

          const { error: updateError } = await supabase
            .from('professionals')
            .update({
              license_number: licenseData.licenseNumber,
              license_verified_at: new Date().toISOString(),
              years_experience: licenseData.yearsExperience,
              phone: licenseData.phone || undefined,
              address: licenseData.address || undefined
            })
            .eq('id', prof.id);

          if (updateError) {
            console.error(`Failed to update ${prof.name}:`, updateError);
          } else {
            updated++;
            setProgress(prev => ({ ...prev, matched, updated }));
          }
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast.success(`Matched ${matched} professionals, updated ${updated} records`);
    } catch (error: any) {
      console.error('License import error:', error);
      toast.error('Failed to import licenses: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arizona License Importer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          This tool matches Arizona real estate professionals with the state license database and populates:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>License numbers</li>
            <li>Years of experience (calculated from issue date)</li>
            <li>Phone numbers</li>
            <li>Office addresses</li>
            <li>Verification status</li>
          </ul>
        </div>

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing {progress.current} of {progress.total}...</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Matched: {progress.matched}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <span>Updated: {progress.updated}</span>
              </div>
            </div>
          </div>
        )}

        <Button 
          onClick={processLicenses}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Import Arizona Licenses'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
