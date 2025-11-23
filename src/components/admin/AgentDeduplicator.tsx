import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Loader2, Trash2, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DuplicateGroup {
  name: string;
  count: number;
  records: Array<{
    id: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    review_stars_rating: number | null;
  }>;
  merged: {
    email: string | null;
    phone: string | null;
    website: string | null;
    kept_id: string;
  };
}

interface DeduplicationResult {
  total_groups: number;
  total_duplicates_removed: number;
  groups: DuplicateGroup[];
}

export const AgentDeduplicator = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeduplicationResult | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    batchNumber: number;
    totalGroups: number;
    totalRemoved: number;
    isRunning: boolean;
  }>({ batchNumber: 0, totalGroups: 0, totalRemoved: 0, isRunning: false });
  const [shouldStop, setShouldStop] = useState(false);
  const { toast } = useToast();

  const runDeduplication = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('deduplicate-agents');

      if (error) throw error;

      setResult(data);
      toast({
        title: "Deduplication Complete",
        description: `Removed ${data.total_duplicates_removed} duplicate records across ${data.total_groups} agent groups`,
      });
    } catch (error: any) {
      console.error('Error deduplicating agents:', error);
      toast({
        title: "Deduplication Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runBatchDeduplication = async () => {
    setBatchProgress({ batchNumber: 0, totalGroups: 0, totalRemoved: 0, isRunning: true });
    setShouldStop(false);
    setResult(null);
    
    let batchNum = 0;
    let cumulativeGroups = 0;
    let cumulativeRemoved = 0;
    
    try {
      while (!shouldStop) {
        batchNum++;
        setBatchProgress(prev => ({ ...prev, batchNumber: batchNum }));
        
        const { data, error } = await supabase.functions.invoke('deduplicate-agents');
        
        if (error) throw error;
        
        const batchResult = data as DeduplicationResult;
        cumulativeGroups += batchResult.total_groups;
        cumulativeRemoved += batchResult.total_duplicates_removed;
        
        setBatchProgress({
          batchNumber: batchNum,
          totalGroups: cumulativeGroups,
          totalRemoved: cumulativeRemoved,
          isRunning: true,
        });
        
        if (batchResult.total_groups === 0) {
          toast({
            title: "Batch Deduplication Complete",
            description: `All duplicates merged! Total: ${cumulativeGroups} groups, ${cumulativeRemoved} duplicates removed across ${batchNum} batches`,
          });
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      if (shouldStop) {
        toast({
          title: "Batch Deduplication Stopped",
          description: `Processed ${cumulativeGroups} groups, removed ${cumulativeRemoved} duplicates across ${batchNum} batches`,
        });
      }
    } catch (error: any) {
      console.error('Batch deduplication error:', error);
      toast({
        title: "Batch Deduplication Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBatchProgress(prev => ({ ...prev, isRunning: false }));
    }
  };

  const stopBatchDeduplication = () => {
    setShouldStop(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Agent Deduplicator
        </CardTitle>
        <CardDescription>
          Find and merge duplicate agent records by combining data from all duplicates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>How it works</AlertTitle>
          <AlertDescription>
            This tool finds agents with identical names, merges their contact information
            (email, phone, website) into the most complete record, and removes duplicates.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={runDeduplication}
            disabled={loading || batchProgress.isRunning}
            variant="outline"
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Single Batch
              </>
            )}
          </Button>
          <Button
            onClick={batchProgress.isRunning ? stopBatchDeduplication : runBatchDeduplication}
            disabled={loading}
            variant={batchProgress.isRunning ? "destructive" : "default"}
            className="flex-1"
          >
            {batchProgress.isRunning ? (
              <>
                <AlertCircle className="mr-2 h-4 w-4" />
                Stop Processing
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Run All Batches
              </>
            )}
          </Button>
        </div>

        {batchProgress.isRunning && (
          <Alert className="border-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Batch Processing Active</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Current Batch:</span>
                  <span className="font-semibold">#{batchProgress.batchNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Groups Merged:</span>
                  <span className="font-semibold">{batchProgress.totalGroups}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duplicates Removed:</span>
                  <span className="font-semibold text-destructive">{batchProgress.totalRemoved}</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Groups Merged</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{result.total_groups}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Duplicates Removed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {result.total_duplicates_removed}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Records Kept</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {result.total_groups}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Merged Groups</h3>
              {result.groups.map((group, idx) => (
                <Card key={idx} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      <Badge variant="secondary">
                        {group.count} records merged
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      {group.merged.email && (
                        <div>
                          <span className="font-medium">Email:</span>{" "}
                          <span className="text-muted-foreground">{group.merged.email}</span>
                        </div>
                      )}
                      {group.merged.phone && (
                        <div>
                          <span className="font-medium">Phone:</span>{" "}
                          <span className="text-muted-foreground">{group.merged.phone}</span>
                        </div>
                      )}
                      {group.merged.website && (
                        <div>
                          <span className="font-medium">Website:</span>{" "}
                          <span className="text-muted-foreground">{group.merged.website}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
