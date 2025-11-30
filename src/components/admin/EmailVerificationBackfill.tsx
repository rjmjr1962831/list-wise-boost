import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface BackfillResult {
  name: string;
  email: string;
  status: 'updated' | 'error';
  message?: string;
  verification_status?: string;
  safe_to_send?: boolean;
}

interface BackfillSummary {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
}

export const EmailVerificationBackfill = () => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<BackfillSummary | null>(null);
  const [results, setResults] = useState<BackfillResult[]>([]);
  const [validCount, setValidCount] = useState<number | null>(null);

  const checkValidEmails = async () => {
    try {
      const { data: queueItems } = await supabase
        .from('email_verification_queue')
        .select('verification_result, professional_id')
        .eq('status', 'completed')
        .not('verification_result', 'is', null);

      let count = 0;
      for (const item of queueItems || []) {
        const result = item.verification_result as any;
        let status = 'unknown';
        let safeToSend = false;

        if (result?.status === 'success' && result?.data) {
          status = result.data.status || 'unknown';
          const safeToSendValue = result.data.safe_to_send;
          safeToSend = safeToSendValue === 'yes' || safeToSendValue === 'risky';
        } else if (result?.data) {
          status = result.data.status || 'unknown';
          const safeToSendValue = result.data.safe_to_send;
          safeToSend = safeToSendValue === 'yes' || safeToSendValue === 'risky';
        }

        if (status === 'valid' && safeToSend) {
          // Check if not already verified
          const { data: prof } = await supabase
            .from('professionals')
            .select('email_verified_at')
            .eq('id', item.professional_id)
            .single();

          if (!prof?.email_verified_at) {
            count++;
          }
        }
      }

      setValidCount(count);
    } catch (error) {
      console.error('Error checking valid emails:', error);
    }
  };

  const runBackfill = async () => {
    setLoading(true);
    setSummary(null);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('backfill-verified-emails');

      if (error) throw error;

      if (data.success) {
        setSummary(data.summary);
        setResults(data.results || []);
        toast.success(`Backfill complete: ${data.summary.updated} emails verified`);
        checkValidEmails();
      } else {
        throw new Error(data.error || 'Backfill failed');
      }
    } catch (error: any) {
      console.error('Error running backfill:', error);
      toast.error(`Backfill failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetFailedQueue = async () => {
    if (!confirm('Reset all failed queue items to pending? They will be reprocessed.')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('email_verification_queue')
        .update({
          status: 'pending',
          error_message: null,
          started_at: null,
          completed_at: null
        })
        .eq('status', 'failed');

      if (error) throw error;

      toast.success('Failed queue items reset to pending');
    } catch (error: any) {
      console.error('Error resetting queue:', error);
      toast.error(`Failed to reset queue: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Email Verification Backfill
        </CardTitle>
        <CardDescription>
          Update professionals table with valid emails from completed verifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            This tool checks completed verifications and updates professionals who were marked as valid 
            but not yet recorded in the database. Accepts both "yes" and "risky" safe_to_send values.
          </AlertDescription>
        </Alert>

        {validCount !== null && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="text-2xl font-bold">{validCount}</div>
            <div className="text-sm text-muted-foreground">Valid emails waiting to be backfilled</div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={checkValidEmails} 
            disabled={loading}
            variant="outline"
          >
            Check Valid Emails
          </Button>

          <Button 
            onClick={runBackfill} 
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Backfill...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Backfill
              </>
            )}
          </Button>

          <Button 
            onClick={resetFailedQueue} 
            disabled={loading}
            variant="destructive"
          >
            Reset Failed Queue
          </Button>
        </div>

        {summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-muted-foreground">Total Checked</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-2xl font-bold">{summary.updated}</div>
                <div className="text-muted-foreground">Updated</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-2xl font-bold">{summary.skipped}</div>
                <div className="text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="text-2xl font-bold">{summary.errors}</div>
                <div className="text-muted-foreground">Errors</div>
              </div>
            </div>

            {results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Results:</h4>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {results.map((result, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{result.name}</div>
                        <div className="text-xs text-muted-foreground">{result.email}</div>
                        {result.message && (
                          <div className="text-xs text-red-500 mt-1">{result.message}</div>
                        )}
                      </div>
                      {result.status === 'updated' ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Updated
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
