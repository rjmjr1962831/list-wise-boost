import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface AgentResult {
  name: string;
  oldEmail: string;
  oldPhone: string | null;
  newEmail: string | null;
  newPhone: string | null;
  specialties?: string[];
  status: 'updated' | 'unchanged' | 'failed' | 'error';
  error?: string;
}

interface BulkUpdateResult {
  total: number;
  processed: number;
  updated: number;
  failed: number;
  agents: AgentResult[];
  batches?: number;
}

export const BulkEmailUpdater = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkUpdateResult | null>(null);
  const [limit, setLimit] = useState(50);
  const [processAll, setProcessAll] = useState(false);

  const runBulkUpdate = async (runAll = false) => {
    setLoading(true);
    setResult(null);
    
    try {
      const message = runAll 
        ? 'Starting bulk update for ALL agents in batches of 50...' 
        : `Starting bulk update for ${limit} agents...`;
      toast.info(message);
      
      const { data, error } = await supabase.functions.invoke('bulk-update-generic-emails', {
        body: { 
          limit: runAll ? undefined : limit,
          processAll: runAll 
        }
      });

      if (error) throw error;

      setResult(data);
      
      if (data.updated > 0) {
        toast.success(`Updated ${data.updated} agent emails with personal addresses`);
      } else {
        toast.info('No personal emails found to update');
      }
    } catch (error: any) {
      console.error('Error in bulk email update:', error);
      toast.error(`Bulk update failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: AgentResult['status']) => {
    switch (status) {
      case 'updated':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'unchanged':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: AgentResult['status']) => {
    const variants: Record<AgentResult['status'], any> = {
      updated: 'default',
      unchanged: 'secondary',
      failed: 'destructive',
      error: 'destructive'
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Bulk Email Updater
          </CardTitle>
          <CardDescription>
            Find agents with generic emails (info@, contact@) or missing phone numbers and re-enrich from memo23
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This will scan all active agents for generic email addresses (info@, contact@, hello@, etc.) 
              or missing phone numbers and re-enrich their profiles from memo23 to extract personal contact details. 
              Each agent is processed sequentially to avoid rate limits.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Number of agents to update:</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={loading}
              />
              <span className="text-sm text-muted-foreground self-center">
                (Use 5 for testing, increase for full updates)
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => runBulkUpdate(false)} 
              disabled={loading}
              className="flex-1"
              size="lg"
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Update {limit} Agents
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => runBulkUpdate(true)} 
              disabled={loading}
              className="flex-1"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing All...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Update ALL Agents (Batches of 50)
                </>
              )}
            </Button>
          </div>

          {result && (
            <>
              {result.batches && result.batches > 1 && (
                <Alert>
                  <AlertDescription>
                    Processed {result.batches} batches of up to 50 agents each
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold">{result.updated}</div>
                  <div className="text-muted-foreground">Updated</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="text-2xl font-bold">{result.processed - result.updated - result.failed}</div>
                  <div className="text-muted-foreground">Unchanged</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-2xl font-bold">{result.failed}</div>
                  <div className="text-muted-foreground">Failed</div>
                </div>
              </div>

              <Progress value={(result.processed / result.total) * 100} className="w-full" />

              <div className="max-h-[500px] overflow-y-auto space-y-2">
                <h4 className="font-semibold text-sm">Agent Results:</h4>
                {result.agents.map((agent, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-3 p-3 bg-muted rounded-lg text-sm"
                  >
                    <div className="pt-0.5">
                      {getStatusIcon(agent.status)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{agent.name}</span>
                        {getStatusBadge(agent.status)}
                      </div>
                      {agent.specialties && agent.specialties.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Specialties: {agent.specialties.join(', ')}
                        </div>
                      )}
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Old Email:</span>
                          <span className="font-mono text-red-600 dark:text-red-400">{agent.oldEmail || 'N/A'}</span>
                        </div>
                        {agent.newEmail && agent.newEmail !== agent.oldEmail && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">New Email:</span>
                            <span className="font-mono text-green-600 dark:text-green-400">{agent.newEmail}</span>
                          </div>
                        )}
                        {(!agent.oldPhone || agent.oldPhone.trim() === '') && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Old Phone:</span>
                            <span className="font-mono text-red-600 dark:text-red-400">Missing</span>
                          </div>
                        )}
                        {agent.newPhone && agent.newPhone !== agent.oldPhone && agent.newPhone.trim() !== '' && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">New Phone:</span>
                            <span className="font-mono text-green-600 dark:text-green-400">{agent.newPhone}</span>
                          </div>
                        )}
                      </div>
                      {agent.error && (
                        <div className="text-xs text-red-500 mt-1">
                          Error: {agent.error}
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
