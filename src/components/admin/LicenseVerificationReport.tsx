import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, FileText, ShieldCheck, AlertCircle } from "lucide-react";

export const LicenseVerificationReport = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    verified: number;
    unverified: number;
    withLicense: number;
    withoutLicense: number;
  } | null>(null);

  const generateReport = async () => {
    try {
      setLoading(true);

      // Fetch all active professionals with relevant fields
      const { data: professionals, error } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          city_id,
          license_number,
          license_verified_at,
          years_experience,
          badges,
          agent_licenses,
          zillow_profile_url,
          email,
          phone
        `)
        .eq('active', true)
        .order('name');

      if (error) throw error;

      if (!professionals || professionals.length === 0) {
        toast.info('No professionals found');
        return;
      }

      // Calculate stats
      const verified = professionals.filter(p => p.license_verified_at).length;
      const withLicense = professionals.filter(p => p.license_number || p.agent_licenses).length;
      
      setStats({
        total: professionals.length,
        verified,
        unverified: professionals.length - verified,
        withLicense,
        withoutLicense: professionals.length - withLicense,
      });

      // Get city names
      const cityIds = [...new Set(professionals.map(p => p.city_id))];
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name, state')
        .in('id', cityIds);

      const cityMap = new Map(cities?.map(c => [c.id, `${c.name}, ${c.state}`]) || []);

      // Generate CSV
      const headers = [
        'Name',
        'City',
        'License Number',
        'Verified',
        'Years Experience',
        'License Verified Date',
        'Badges',
        'Email',
        'Phone',
        'Zillow URL'
      ];

      const rows = professionals.map(prof => {
        const hasVerifiedBadge = (prof.badges || []).includes('License Verified');
        
        return [
          prof.name,
          cityMap.get(prof.city_id) || 'Unknown',
          prof.license_number || 'N/A',
          prof.license_verified_at ? 'Yes' : 'No',
          prof.years_experience || 'N/A',
          prof.license_verified_at ? new Date(prof.license_verified_at).toLocaleDateString() : 'N/A',
          hasVerifiedBadge ? 'License Verified' : '',
          prof.email || 'N/A',
          prof.phone || 'N/A',
          prof.zillow_profile_url || 'N/A'
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `license-verification-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Report generated: ${professionals.length} agents`);
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          License Verification Report
        </CardTitle>
        <CardDescription>
          Export a detailed report of all agents with their license verification status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Agents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.unverified}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Unverified
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.withLicense}</div>
              <div className="text-xs text-muted-foreground">With License #</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.withoutLicense}</div>
              <div className="text-xs text-muted-foreground">No License #</div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Report includes:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Agent name and city</li>
            <li>License number and verification status</li>
            <li>Years of experience (from verified licenses)</li>
            <li>License verification date</li>
            <li>Contact information (email, phone)</li>
            <li>Zillow profile URL</li>
          </ul>
        </div>

        <Button
          onClick={generateReport}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export License Verification Report
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
