import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";

export const ReplicateAgentPhoenix = () => {
  const [isReplicating, setIsReplicating] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleReplicate = async () => {
    try {
      setIsReplicating(true);
      setResults(null);

      // George Laughton's ID from Scottsdale
      const laughtonId = 'fe8a77bd-c2c5-474d-a7bb-244195692d77';

      console.log('Starting replication for Laughton...');
      toast.loading('Enriching and replicating Laughton across Phoenix metro...', {
        id: 'replicate-laughton'
      });

      const { data, error } = await supabase.functions.invoke('replicate-agent-phoenix', {
        body: { professionalId: laughtonId }
      });

      if (error) {
        throw error;
      }

      console.log('Replication complete:', data);
      setResults(data);
      
      toast.success('Successfully replicated Laughton!', {
        id: 'replicate-laughton',
        description: `${data.results?.length || 0} markets updated`
      });

    } catch (error: any) {
      console.error('Replication error:', error);
      toast.error('Failed to replicate agent', {
        id: 'replicate-laughton',
        description: error.message
      });
    } finally {
      setIsReplicating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy className="h-5 w-5" />
          Replicate Agent Across Phoenix Metro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This will:
          </p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            <li>Re-enrich George Laughton's profile with memo23</li>
            <li>Replicate the enriched data across all Phoenix metro markets</li>
            <li>Update existing records or create new ones as needed</li>
          </ol>
        </div>

        <Button 
          onClick={handleReplicate}
          disabled={isReplicating}
          className="w-full"
        >
          {isReplicating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Replicating...
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Replicate Laughton Across Phoenix Metro
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Results:</h3>
            <div className="rounded-md bg-muted p-3 space-y-1">
              {results.results?.map((result: any, idx: number) => (
                <div 
                  key={idx}
                  className="text-xs flex items-center justify-between"
                >
                  <span className="font-medium">{result.city}:</span>
                  <span className={
                    result.status === 'created' ? 'text-green-600' :
                    result.status === 'updated' ? 'text-blue-600' :
                    'text-red-600'
                  }>
                    {result.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
