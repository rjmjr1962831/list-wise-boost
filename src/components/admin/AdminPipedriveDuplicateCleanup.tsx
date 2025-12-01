import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DuplicateGroup {
  email: string;
  contacts: {
    id: number;
    name: string;
    add_time: string;
    professional_id?: string;
  }[];
}

export function AdminPipedriveDuplicateCleanup() {
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);

  const scanForDuplicates = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("pipedrive-find-duplicates", {
        body: { action: "scan" }
      });

      if (error) throw error;

      if (data.success && data.duplicates) {
        setDuplicates(data.duplicates);
        
        if (data.duplicates.length === 0) {
          toast.success("No duplicates found!");
        } else {
          toast.info(`Found ${data.duplicates.length} duplicate groups`);
        }
      } else {
        throw new Error(data.error || "Failed to scan");
      }
    } catch (error) {
      console.error("Scan error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to scan for duplicates");
    } finally {
      setIsScanning(false);
    }
  };

  const cleanupDuplicates = async () => {
    if (duplicates.length === 0) {
      toast.error("No duplicates to clean up. Run scan first.");
      return;
    }

    setIsCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke("pipedrive-find-duplicates", {
        body: { action: "cleanup", duplicates }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Cleanup complete! Processed ${data.successCount} groups, ${data.failCount} failures`);
        setDuplicates([]);
      } else {
        throw new Error(data.error || "Failed to cleanup");
      }
    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cleanup duplicates");
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipedrive Duplicate Cleanup</CardTitle>
        <CardDescription>
          Scan for and remove duplicate Pipedrive contacts created before the search fix
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {duplicates.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Found {duplicates.length} duplicate group(s). Review the list below before cleanup.
            </AlertDescription>
          </Alert>
        )}

        {duplicates.length > 0 && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {duplicates.map((group, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">{group.email}</CardTitle>
                  <CardDescription>
                    {group.contacts.length} duplicates found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {group.contacts.map((contact, cidx) => (
                      <div
                        key={contact.id}
                        className={`flex items-center justify-between p-2 rounded ${
                          cidx === 0 ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {cidx === 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                          <div>
                            <div className="font-medium text-sm">{contact.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {contact.id} • Created: {new Date(contact.add_time).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-medium">
                          {cidx === 0 ? "KEEP" : "DELETE"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={scanForDuplicates}
            disabled={isScanning || isCleaning}
          >
            {isScanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isScanning ? "Scanning..." : "Scan for Duplicates"}
          </Button>

          {duplicates.length > 0 && (
            <Button
              onClick={cleanupDuplicates}
              disabled={isScanning || isCleaning}
              variant="destructive"
            >
              {isCleaning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCleaning ? "Cleaning..." : `Clean Up ${duplicates.length} Groups`}
            </Button>
          )}
        </div>

        <Alert>
          <AlertDescription>
            <strong>How it works:</strong>
            <ul className="list-disc list-inside mt-2 text-sm space-y-1">
              <li>Scans all active professionals with emails</li>
              <li>Searches Pipedrive for duplicate contacts by email</li>
              <li>Keeps the oldest contact (by creation date)</li>
              <li>Deletes all newer duplicates</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
