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
    data_richness?: number;
  }[];
}

export function AdminPipedriveDuplicateCleanup() {
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [scanType, setScanType] = useState<'supabase' | 'full-email' | 'full-name'>('supabase');
  const [cleanupMethod, setCleanupMethod] = useState<'delete' | 'merge'>('merge');

  const scanForDuplicates = async () => {
    setIsScanning(true);
    try {
      if (scanType === 'supabase') {
        // Original Supabase-based scan
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
      } else {
        // Full Pipedrive scan
        const scanTypeParam = scanType === 'full-email' ? 'email' : 'name';
        const { data, error } = await supabase.functions.invoke("pipedrive-full-duplicate-scan", {
          body: { scanType: scanTypeParam }
        });

        if (error) throw error;

        if (data.success && data.duplicates) {
          setDuplicates(data.duplicates);
          
          if (data.duplicates.length === 0) {
            toast.success("No duplicates found!");
          } else {
            toast.info(`Found ${data.duplicates.length} duplicate groups (${data.totalPersons} total persons scanned)`);
          }
        } else {
          throw new Error(data.error || "Failed to scan");
        }
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
        body: { action: "cleanup", duplicates, cleanupMethod }
      });

      if (error) throw error;

      if (data.success) {
        const method = cleanupMethod === 'merge' ? 'merged' : 'deleted';
        toast.success(`Cleanup complete! ${data.successCount} ${method}, ${data.failCount} failures`);
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
          Scan for and remove/merge duplicate Pipedrive contacts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Scan Type</label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={scanType === 'supabase' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScanType('supabase')}
                disabled={isScanning || isCleaning}
              >
                Supabase Agents
              </Button>
              <Button
                variant={scanType === 'full-email' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScanType('full-email')}
                disabled={isScanning || isCleaning}
              >
                Full Email Scan
              </Button>
              <Button
                variant={scanType === 'full-name' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScanType('full-name')}
                disabled={isScanning || isCleaning}
              >
                Full Name Scan
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {scanType === 'supabase' && 'Scans only agents in Supabase database'}
              {scanType === 'full-email' && 'Scans ALL Pipedrive contacts by email'}
              {scanType === 'full-name' && 'Scans ALL Pipedrive contacts by name (manual review recommended)'}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Cleanup Method</label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={cleanupMethod === 'merge' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCleanupMethod('merge')}
                disabled={isScanning || isCleaning}
              >
                Merge (Preserve Data)
              </Button>
              <Button
                variant={cleanupMethod === 'delete' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCleanupMethod('delete')}
                disabled={isScanning || isCleaning}
              >
                Delete
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {cleanupMethod === 'merge' && 'Merges duplicates into contact with most data (deals, activities, notes)'}
              {cleanupMethod === 'delete' && 'Permanently deletes duplicate contacts'}
            </p>
          </div>
        </div>
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
                              {contact.data_richness !== undefined && ` • Data Score: ${contact.data_richness}`}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-medium">
                          {cidx === 0 ? "KEEP" : cleanupMethod === 'merge' ? 'MERGE' : 'DELETE'}
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
              variant={cleanupMethod === 'delete' ? 'destructive' : 'default'}
            >
              {isCleaning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCleaning ? `${cleanupMethod === 'merge' ? 'Merging' : 'Deleting'}...` : `${cleanupMethod === 'merge' ? 'Merge' : 'Delete'} ${duplicates.length} Groups`}
            </Button>
          )}
        </div>

        <Alert>
          <AlertDescription>
            <strong>How it works:</strong>
            <ul className="list-disc list-inside mt-2 text-sm space-y-1">
              <li><strong>Supabase Agents:</strong> Scans only professionals in database with emails</li>
              <li><strong>Full Email Scan:</strong> Fetches ALL Pipedrive contacts and groups by email</li>
              <li><strong>Full Name Scan:</strong> Groups by name (may include different people - manual review recommended)</li>
              <li><strong>Merge:</strong> Keeps contact with most data (deals, activities, notes) and merges others into it</li>
              <li><strong>Delete:</strong> Keeps contact with most data and permanently deletes duplicates</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
