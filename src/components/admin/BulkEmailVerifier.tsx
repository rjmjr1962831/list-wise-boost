import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VerificationResult {
  id: string;
  name: string;
  email: string;
  status: 'valid' | 'invalid' | 'catch_all' | 'unknown' | 'failed';
  safe_to_send?: boolean;
  email_quality_score?: number;
  reason?: string;
  error?: string;
}

interface BulkVerificationResult {
  total: number;
  verified: number;
  invalid: number;
  unknown: number;
  failed: number;
  results: VerificationResult[];
}

export const BulkEmailVerifier = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkVerificationResult | null>(null);
  const [limit, setLimit] = useState(20);
  const [skipGeneric, setSkipGeneric] = useState(true);
  const [citySlug, setCitySlug] = useState<string>('');
  const [cities, setCities] = useState<Array<{ name: string; slug: string }>>([]);
  const [unverifiedCount, setUnverifiedCount] = useState<number>(0);

  useEffect(() => {
    fetchCities();
    fetchUnverifiedCount();
  }, []);

  const fetchCities = async () => {
    const { data } = await supabase
      .from('cities')
      .select('name, slug')
      .eq('active', true)
      .order('name');
    
    if (data) setCities(data);
  };

  const fetchUnverifiedCount = async () => {
    const { count } = await supabase
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .not('email', 'is', null)
      .is('email_verified_at', null);
    
    setUnverifiedCount(count || 0);
  };

  const runVerification = async (verifyAll = false) => {
    setLoading(true);
    setResult(null);
    
    try {
      const message = verifyAll 
        ? `Starting verification for ALL ${unverifiedCount} unverified emails...` 
        : `Starting verification for ${limit} emails...`;
      toast.info(message);
      
      const { data, error } = await supabase.functions.invoke('verify-emails-clearout', {
        body: { 
          limit: verifyAll ? null : limit,
          skipGeneric,
          citySlug: citySlug || null,
        }
      });

      if (error) throw error;

      setResult(data);
      await fetchUnverifiedCount();
      
      if (data.verified > 0) {
        toast.success(`Verified ${data.verified} valid emails!`);
      } else {
        toast.info('No emails were verified');
      }
    } catch (error: any) {
      console.error('Error in email verification:', error);
      toast.error(`Verification failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: VerificationResult['status']) => {
    switch (status) {
      case 'valid':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'catch_all':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'unknown':
        return <HelpCircle className="h-4 w-4 text-gray-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (result: VerificationResult) => {
    if (result.status === 'valid' && result.safe_to_send) {
      return <Badge variant="default" className="bg-green-500">✓ Valid</Badge>;
    }
    if (result.status === 'invalid') {
      return <Badge variant="destructive">✗ Invalid</Badge>;
    }
    if (result.status === 'catch_all') {
      return <Badge variant="secondary">⚠ Catch-all</Badge>;
    }
    if (result.status === 'unknown') {
      return <Badge variant="outline">? Unknown</Badge>;
    }
    return <Badge variant="destructive">Failed</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Bulk Email Verifier (Clearout)
          </CardTitle>
          <CardDescription>
            Verify agent emails using Clearout's instant verification API • {unverifiedCount} unverified emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This uses Clearout's API to verify email deliverability. Valid emails will be marked as verified.
              Cost: ~$0.02 per verification. Skipping generic emails saves credits.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Number of emails:</label>
              <input
                type="number"
                min="1"
                max="500"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by city:</label>
              <Select value={citySlug || "all"} onValueChange={(val) => setCitySlug(val === "all" ? "" : val)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="All cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city.slug} value={city.slug}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Options:</label>
              <div className="flex items-center space-x-2 h-10">
                <Checkbox
                  id="skipGeneric"
                  checked={skipGeneric}
                  onCheckedChange={(checked) => setSkipGeneric(checked as boolean)}
                  disabled={loading}
                />
                <label
                  htmlFor="skipGeneric"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Skip generic emails
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => runVerification(false)} 
              disabled={loading}
              className="flex-1"
              size="lg"
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify {limit} Emails
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => runVerification(true)} 
              disabled={loading || unverifiedCount === 0}
              className="flex-1"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying All...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify ALL ({unverifiedCount} emails)
                </>
              )}
            </Button>
          </div>

          {result && (
            <>
              <div className="grid grid-cols-5 gap-4 text-sm">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold">{result.verified}</div>
                  <div className="text-muted-foreground">Verified</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-2xl font-bold">{result.invalid}</div>
                  <div className="text-muted-foreground">Invalid</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="text-2xl font-bold">{result.unknown}</div>
                  <div className="text-muted-foreground">Unknown</div>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
                  <div className="text-2xl font-bold">{result.failed}</div>
                  <div className="text-muted-foreground">Failed</div>
                </div>
              </div>

              <Progress value={(result.total > 0 ? (result.verified / result.total) * 100 : 0)} className="w-full" />

              <div className="max-h-[500px] overflow-y-auto space-y-2">
                <h4 className="font-semibold text-sm">Verification Results:</h4>
                {result.results.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-3 p-3 bg-muted rounded-lg text-sm"
                  >
                    <div className="pt-0.5">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.name}</span>
                        {getStatusBadge(item)}
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-mono">{item.email}</span>
                        </div>
                        {item.email_quality_score !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Quality Score:</span>
                            <span className="font-semibold">{item.email_quality_score}/100</span>
                          </div>
                        )}
                        {item.reason && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Reason:</span>
                            <span className="text-xs">{item.reason}</span>
                          </div>
                        )}
                      </div>
                      {item.error && (
                        <div className="text-xs text-red-500 mt-1">
                          Error: {item.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
