import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FieldResult {
  field_name: string;
  pipedrive_key?: string;
  error?: string;
}

export function AdminPipedriveFieldCreator() {
  const [isCreating, setIsCreating] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [results, setResults] = useState<{
    created: FieldResult[];
    failed: FieldResult[];
  } | null>(null);
  const { toast } = useToast();

  const handleCleanupInvalidMappings = async () => {
    setIsCleaningUp(true);
    try {
      // Delete mappings that don't correspond to valid Pipedrive fields
      const invalidFields = [
        'current_listings', 'total_sales', 'license_number', 'rank',
        'synthesized_bio', 'is_top_agent', 'is_premier_agent', 'city_name', 'state'
      ];

      const { error } = await supabase
        .from('pipedrive_field_mapping')
        .delete()
        .in('field_name', invalidFields);

      if (error) throw error;

      toast({
        title: "Cleanup Complete",
        description: `Removed ${invalidFields.length} invalid field mappings`,
      });
    } catch (error) {
      console.error("Error cleaning up mappings:", error);
      toast({
        title: "Cleanup Error",
        description: error instanceof Error ? error.message : "Failed to clean up mappings",
        variant: "destructive",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleCreateFields = async () => {
    setIsCreating(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke("create-pipedrive-fields", {
        body: {},
      });

      if (error) throw error;

      setResults(data.results);

      toast({
        title: "Field Creation Complete",
        description: `Created ${data.results.created.length} fields, ${data.results.failed.length} failed`,
      });
    } catch (error) {
      console.error("Error creating fields:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create fields",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Create Pipedrive Custom Fields
        </CardTitle>
        <CardDescription>
          Automatically create missing custom fields in Pipedrive and store their mappings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            This will create 10 custom fields in Pipedrive: profile_link, current_listings, total_sales, license_number, 
            rank, synthesized_bio, is_top_agent, is_premier_agent, city_name, and state.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={handleCleanupInvalidMappings}
            disabled={isCleaningUp || isCreating}
            variant="outline"
            className="flex-1"
          >
            {isCleaningUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cleaning Up...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Clean Up Invalid Mappings
              </>
            )}
          </Button>

          <Button
            onClick={handleCreateFields}
            disabled={isCreating || isCleaningUp}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Fields...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Create Missing Fields
              </>
            )}
          </Button>
        </div>

        {results && (
          <div className="space-y-4 mt-6">
            {results.created.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-green-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Successfully Created ({results.created.length})
                </h3>
                <div className="space-y-1">
                  {results.created.map((field) => (
                    <div
                      key={field.field_name}
                      className="text-sm p-2 bg-green-50 rounded border border-green-200"
                    >
                      <span className="font-medium">{field.field_name}</span>
                      <span className="text-muted-foreground ml-2">→ {field.pipedrive_key}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.failed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Failed ({results.failed.length})
                </h3>
                <div className="space-y-1">
                  {results.failed.map((field) => (
                    <div
                      key={field.field_name}
                      className="text-sm p-2 bg-red-50 rounded border border-red-200"
                    >
                      <span className="font-medium">{field.field_name}</span>
                      <span className="text-muted-foreground ml-2 block text-xs">
                        {field.error}
                      </span>
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
}
