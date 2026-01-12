import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, CheckCircle, XCircle, Loader2, Database, MapPin } from 'lucide-react';
import { agentZipRecords, TOTAL_RECORDS } from '@/data/agentZipRecords';

// Smaller batch size to avoid timeout issues with edge functions
const BATCH_SIZE = 200;

export const ImportAgentZipActivity: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [importComplete, setImportComplete] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    setProgress(0);
    setSuccessCount(0);
    setErrorCount(0);
    setImportComplete(false);

    const records = agentZipRecords;
    const batches = Math.ceil(records.length / BATCH_SIZE);
    setTotalBatches(batches);

    let totalSuccess = 0;
    let totalErrors = 0;

    for (let i = 0; i < batches; i++) {
      setCurrentBatch(i + 1);
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, records.length);
      const batch = records.slice(start, end);

      try {
        const { data, error } = await supabase.functions.invoke('import-agent-zip-activity', {
          body: { records: batch }
        });

        if (error) {
          console.error(`Batch ${i + 1} error:`, error);
          totalErrors += batch.length;
          toast.error(`Batch ${i + 1} failed: ${error.message}`);
        } else {
          // Edge function returns 'imported' and 'errors' fields
          totalSuccess += data.imported || 0;
          totalErrors += data.errors || 0;
        }
      } catch (err: any) {
        console.error(`Batch ${i + 1} exception:`, err);
        totalErrors += batch.length;
        toast.error(`Batch ${i + 1} exception: ${err.message}`);
      }

      const progressPercent = Math.round(((i + 1) / batches) * 100);
      setProgress(progressPercent);
      setSuccessCount(totalSuccess);
      setErrorCount(totalErrors);

      // Small delay between batches to avoid rate limiting
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsImporting(false);
    setImportComplete(true);
    toast.success(`Import complete! ${totalSuccess} records imported, ${totalErrors} errors`);
  };

  const verifyImport = async () => {
    try {
      const { count, error } = await supabase
        .from('agent_zip_activity')
        .select('*', { count: 'exact', head: true });

      if (error) {
        toast.error(`Verification failed: ${error.message}`);
      } else {
        toast.success(`Verified: ${count} records in agent_zip_activity table`);
      }
    } catch (err: any) {
      toast.error(`Verification error: ${err.message}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Import Agent ZIP Activity
        </CardTitle>
        <CardDescription>
          Import {TOTAL_RECORDS.toLocaleString()} verified agent-ZIP transaction records for transaction-based neighborhood matching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Records</span>
              </div>
              <p className="text-2xl font-bold mt-1">{TOTAL_RECORDS.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Imported</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-green-700">{successCount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-600">Errors</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-700">{errorCount.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Section */}
        {isImporting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Batch {currentBatch} of {totalBatches}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Import Complete Message */}
        {importComplete && (
          <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700 dark:text-green-400">
                Import complete! {successCount.toLocaleString()} records imported successfully.
              </span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-500 mt-1">
              The agent_zip_activity table now has verified transaction data for neighborhood matching.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleImport}
            disabled={isImporting}
            className="flex-1"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing... ({currentBatch}/{totalBatches})
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Start Import
              </>
            )}
          </Button>
          <Button
            onClick={verifyImport}
            variant="outline"
            disabled={isImporting}
          >
            <Database className="mr-2 h-4 w-4" />
            Verify Count
          </Button>
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground">
          This imports verified agent transaction data from MLS records. Each record maps an agent (by license number) 
          to a ZIP code where they have confirmed transaction activity. The data enables accurate neighborhood agent matching 
          based on actual transaction history rather than office location guessing.
        </p>
      </CardContent>
    </Card>
  );
};
