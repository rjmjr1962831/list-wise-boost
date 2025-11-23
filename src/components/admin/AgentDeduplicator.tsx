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

        <Button
          onClick={runDeduplication}
          disabled={loading}
          variant="default"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deduplicating...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Find & Merge Duplicates
            </>
          )}
        </Button>

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
