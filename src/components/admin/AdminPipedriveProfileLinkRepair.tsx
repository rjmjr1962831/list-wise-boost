import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AdminPipedriveProfileLinkRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleRepair = async (dryRun: boolean) => {
    try {
      setIsDryRun(dryRun);
      setIsRepairing(true);
      setResults(null);

      const { data, error } = await supabase.functions.invoke(
        "repair-pipedrive-profile-links",
        {
          body: { 
            limit: 100,
            dry_run: dryRun 
          },
        }
      );

      if (error) throw error;

      setResults(data);
      
      if (dryRun) {
        toast.success("Dry run completed - no changes made");
      } else {
        toast.success(`Repaired ${data.updated} magic links`);
      }
    } catch (error: any) {
      console.error("Repair error:", error);
      toast.error(error.message || "Failed to repair magic links");
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Repair Pipedrive Magic Links
        </CardTitle>
        <CardDescription>
          Fix malformed magic link values in Pipedrive. This will update all professionals
          with their correct full URL magic links (https://top10lists.us/profile/UUID).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>What this does:</strong> Searches for each professional in Pipedrive by email
            and updates their magic link field with the correct full URL from the database.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={() => handleRepair(true)}
            disabled={isRepairing}
            variant="outline"
          >
            {isRepairing && isDryRun ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Running Dry Run...
              </>
            ) : (
              "Dry Run (Preview)"
            )}
          </Button>

          <Button
            onClick={() => handleRepair(false)}
            disabled={isRepairing}
          >
            {isRepairing && !isDryRun ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Repairing...
              </>
            ) : (
              "Run Repair"
            )}
          </Button>
        </div>

        {results && (
          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Results
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {results.updated}
                </div>
                <div className="text-sm text-muted-foreground">
                  {results.dry_run ? "Would Update" : "Updated"}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="text-2xl font-bold text-yellow-600">
                  {results.skipped}
                </div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              
              <div className="space-y-1">
                <div className="text-2xl font-bold text-red-600">
                  {results.errors}
                </div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
            </div>

            {results.profile_link_field_key && (
              <div className="text-sm text-muted-foreground">
                Using Pipedrive field: <code className="bg-muted px-1 py-0.5 rounded">{results.profile_link_field_key}</code>
              </div>
            )}

            {results.errors > 0 && results.errors && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-red-600">Errors:</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {results.errors.map((error: string, i: number) => (
                    <div key={i} className="text-xs bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {results.message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
