import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";

export const LicenseVerifier = () => {
  const [verifying, setVerifying] = useState(false);
  const [stats, setStats] = useState<{ verified: number; failed: number; total: number } | null>(null);

  const verifyLicenses = async () => {
    try {
      setVerifying(true);
      setStats({ verified: 0, failed: 0, total: 0 });

      // Fetch all professionals in Arizona with license numbers from memo23
      const { data: professionals, error } = await supabase
        .from('professionals')
        .select('id, name, license_number, agent_licenses')
        .eq('active', true)
        .not('agent_licenses', 'is', null);

      if (error) throw error;

      if (!professionals || professionals.length === 0) {
        toast.info('No professionals with license numbers found');
        return;
      }

      let verified = 0;
      let failed = 0;

      for (const professional of professionals) {
        // Extract license number from agent_licenses JSON
        let licenseNumber: string | null = professional.license_number;
        
        if (!licenseNumber && professional.agent_licenses) {
          try {
            const licenses = typeof professional.agent_licenses === 'string' 
              ? JSON.parse(professional.agent_licenses)
              : professional.agent_licenses;
            
            if (Array.isArray(licenses) && licenses.length > 0) {
              licenseNumber = licenses[0].licenseNumber || licenses[0].license_number;
            }
          } catch (e) {
            console.error('Error parsing agent_licenses:', e);
          }
        }

        if (!licenseNumber) {
          failed++;
          setStats({ verified, failed, total: professionals.length });
          continue;
        }

        // Call verification edge function
        const { data, error: verifyError } = await supabase.functions.invoke('verify-arizona-license', {
          body: {
            professionalId: professional.id,
            licenseNumber: licenseNumber,
          },
        });

        if (verifyError) {
          console.error(`Failed to verify ${professional.name}:`, verifyError);
          failed++;
        } else if (data?.verified) {
          console.log(`Verified ${professional.name}: ${data.yearsExperience} years`);
          verified++;
        } else {
          console.log(`License not found for ${professional.name}`);
          failed++;
        }

        setStats({ verified, failed, total: professionals.length });
        
        // Add a small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast.success(`Verification complete! ${verified} verified, ${failed} not found`);
    } catch (error: any) {
      console.error('Error verifying licenses:', error);
      toast.error('Failed to verify licenses');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Arizona License Verifier
        </CardTitle>
        <CardDescription>
          Verify agent license numbers against the Arizona license database and calculate years of experience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
              <div className="text-xs text-muted-foreground">Verified</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-xs text-muted-foreground">Not Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        )}
        
        <Button
          onClick={verifyLicenses}
          disabled={verifying}
          className="w-full"
        >
          {verifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying Licenses...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Verify All Arizona Licenses
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
