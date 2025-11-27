import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export const TestSpecialtyExtraction = () => {
  const [testing, setTesting] = useState(false);
  const [testAgentId, setTestAgentId] = useState('bc5e1a45-30ae-440f-9156-6b9e8e7c5b33'); // Mike Drefs
  const [result, setResult] = useState<any>(null);

  const runTest = async () => {
    if (!testAgentId) {
      toast.error('Please enter an agent ID');
      return;
    }

    setTesting(true);
    setResult(null);
    
    try {
      // Get agent before enrichment
      const { data: beforeAgent } = await supabase
        .from('professionals')
        .select('id, name, zillow_profile_url, specialty')
        .eq('id', testAgentId)
        .single();

      if (!beforeAgent) {
        throw new Error('Agent not found');
      }

      console.log('Before enrichment:', beforeAgent);
      toast.info(`Testing specialty extraction for ${beforeAgent.name}...`);

      // Run memo23 enrichment
      const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
        body: { professionalId: testAgentId }
      });

      if (error) throw error;

      console.log('Memo23 response:', data);

      // Get agent after enrichment
      const { data: afterAgent } = await supabase
        .from('professionals')
        .select('id, name, zillow_profile_url, specialty, professional_information')
        .eq('id', testAgentId)
        .single();

      console.log('After enrichment:', afterAgent);

      setResult({
        agentName: beforeAgent.name,
        beforeSpecialties: beforeAgent.specialty || [],
        afterSpecialties: afterAgent?.specialty || [],
        memo23Data: data,
        success: (afterAgent?.specialty && afterAgent.specialty.length > 0)
      });

      if (afterAgent?.specialty && afterAgent.specialty.length > 0) {
        toast.success(`✅ Successfully extracted ${afterAgent.specialty.length} specialties!`);
      } else {
        toast.warning('⚠️ No specialties found in memo23 data');
      }

    } catch (error: any) {
      console.error('Test failed:', error);
      toast.error(`Test failed: ${error.message}`);
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Specialty Extraction</CardTitle>
        <CardDescription>
          Run memo23 enrichment on an agent to verify specialty extraction is working
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agentId">Agent ID (default: Mike Drefs)</Label>
          <Input
            id="agentId"
            value={testAgentId}
            onChange={(e) => setTestAgentId(e.target.value)}
            placeholder="Enter agent UUID"
          />
          <p className="text-xs text-muted-foreground">
            Available test agents: Mike Drefs (bc5e1a45...), Josh Brill (a4dc4da2...), Jennifer Rogers (f6cd4afa...)
          </p>
        </div>

        <Button 
          onClick={runTest} 
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Memo23 Enrichment...
            </>
          ) : (
            'Test Specialty Extraction'
          )}
        </Button>

        {result && (
          <div className="space-y-3 mt-4">
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <h4 className="font-semibold">{result.agentName || 'Test Result'}</h4>
                
                {result.error ? (
                  <p className="text-sm text-red-500">{result.error}</p>
                ) : (
                  <>
                    <div className="bg-muted p-3 rounded-md space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Before:</span>{' '}
                        {result.beforeSpecialties?.length > 0 
                          ? result.beforeSpecialties.join(', ')
                          : 'No specialties'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">After:</span>{' '}
                        {result.afterSpecialties?.length > 0 
                          ? result.afterSpecialties.join(', ')
                          : 'No specialties found'}
                      </p>
                    </div>

                    {result.memo23Data && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View raw memo23 response
                        </summary>
                        <pre className="mt-2 bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap">
                          {JSON.stringify(result.memo23Data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
