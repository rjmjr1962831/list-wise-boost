import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, TestTube2, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  verification_token: string | null;
  verification_token_expires_at: string | null;
  funnel_status: string | null;
  city_id: string;
  cities: { name: string; slug: string } | null;
}

export const AgentFunnelTester = () => {
  const [loading, setLoading] = useState(false);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [testToken, setTestToken] = useState<string | null>(null);
  const [funnelUrl, setFunnelUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const fetchProfessionals = async () => {
    const { data, error } = await supabase
      .from('professionals')
      .select('id, name, email, verification_token, verification_token_expires_at, funnel_status, city_id, cities(name, slug)')
      .eq('active', true)
      .not('email', 'is', null)
      .order('name')
      .limit(100);

    if (error) {
      console.error('Error fetching professionals:', error);
      toast.error('Failed to load professionals');
      return;
    }

    setProfessionals(data || []);
  };

  const generateTestToken = async () => {
    if (!selectedProfessionalId) {
      toast.error('Please select a professional');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-test-profile-token', {
        body: { professionalId: selectedProfessionalId }
      });

      if (error) throw error;

      setTestToken(data.token);
      setFunnelUrl(data.funnelUrl);
      setExpiresAt(data.expiresAt);

      toast.success(`Test token generated for ${data.professionalName}`);
      
      // Refresh the list to show updated token
      await fetchProfessionals();
    } catch (error: any) {
      console.error('Error generating test token:', error);
      toast.error(`Failed to generate token: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const openFunnel = () => {
    if (funnelUrl) {
      window.open(funnelUrl, '_blank');
    }
  };

  const quickTest = async () => {
    if (professionals.length === 0) {
      toast.error('No professionals available to test');
      return;
    }

    const firstPro = professionals[0];
    setSelectedProfessionalId(firstPro.id);
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-test-profile-token', {
        body: { professionalId: firstPro.id }
      });

      if (error) throw error;

      // Open funnel immediately
      window.open(data.funnelUrl, '_blank');
      
      toast.success(`Opening funnel for ${data.professionalName}`);
      await fetchProfessionals();
    } catch (error: any) {
      console.error('Error in quick test:', error);
      toast.error(`Failed to start test: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedProfessional = professionals.find(p => p.id === selectedProfessionalId);
  const hasExistingToken = selectedProfessional?.verification_token;
  const existingTokenExpired = selectedProfessional?.verification_token_expires_at 
    ? new Date(selectedProfessional.verification_token_expires_at) < new Date()
    : false;

  const funnelSteps = [
    { path: '/profile/:token', name: 'Welcome', status: 'welcome' },
    { path: '/profile/:token/edit', name: 'Edit Profile', status: 'edit_complete' },
    { path: '/profile/:token/pricing', name: 'Pricing', status: 'pricing_viewed' },
    { path: '/profile/:token/select', name: 'Selection', status: 'selection_made' },
    { path: '/profile/:token/schedule', name: 'Schedule Call', status: 'call_scheduled' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube2 className="h-5 w-5" />
          Agent Funnel Tester
        </CardTitle>
        <CardDescription>
          Generate test tokens and preview the agent editing funnel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            The agent funnel allows verified agents to edit their profile and purchase listing upgrades.
            Test tokens expire after 7 days.
          </AlertDescription>
        </Alert>

        <Button
          onClick={quickTest}
          disabled={loading || professionals.length === 0}
          className="w-full"
          size="lg"
          variant="default"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting Test...
            </>
          ) : (
            <>
              <TestTube2 className="mr-2 h-4 w-4" />
              Quick Test (Opens Funnel Immediately)
            </>
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or select specific professional
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Select Professional:</label>
          <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a professional to test..." />
            </SelectTrigger>
            <SelectContent>
              {professionals.map((prof) => (
                <SelectItem key={prof.id} value={prof.id}>
                  {prof.name} {prof.cities ? `- ${prof.cities.name}` : ''}
                  {prof.verification_token && ' ✓'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProfessional && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Status:</span>
              <Badge variant={selectedProfessional.funnel_status ? "default" : "secondary"}>
                {selectedProfessional.funnel_status || 'Not Started'}
              </Badge>
            </div>
            
            {hasExistingToken && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Existing Token:</span>
                  <div className="flex gap-2">
                    <code className="text-xs bg-background px-2 py-1 rounded">
                      {selectedProfessional.verification_token?.substring(0, 8)}...
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedProfessional.verification_token!, 'Token')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Expires:</span>
                  <span className={`text-xs ${existingTokenExpired ? 'text-destructive' : ''}`}>
                    {existingTokenExpired ? 'Expired' : new Date(selectedProfessional.verification_token_expires_at!).toLocaleDateString()}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <Button
          onClick={generateTestToken}
          disabled={loading || !selectedProfessionalId}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Token...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {hasExistingToken ? 'Regenerate Test Token' : 'Generate Test Token'}
            </>
          )}
        </Button>

        {testToken && funnelUrl && (
          <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-900 dark:text-green-100">✓ Token Generated</span>
              <span className="text-xs text-green-700 dark:text-green-300">
                Expires: {new Date(expiresAt!).toLocaleDateString()}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs bg-white dark:bg-background px-2 py-1 rounded flex-1 truncate">
                  {testToken}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(testToken, 'Token')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={openFunnel}
                >
                  <ExternalLink className="mr-2 h-3 w-3" />
                  Open Funnel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(window.location.origin + funnelUrl, 'URL')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-4 border-t">
          <h4 className="text-sm font-semibold">Funnel Steps:</h4>
          <div className="space-y-1">
            {funnelSteps.map((step, index) => (
              <div key={index} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                <span className="font-mono">{step.path}</span>
                <Badge variant="outline" className="text-xs">
                  {step.name}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
