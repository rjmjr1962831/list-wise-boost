import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

interface ImportStats {
  totalInserted: number;
  totalSkippedTooOld: number;
  totalSkippedInvalid: number;
  totalErrors: number;
  filesProcessed: number;
  totalFiles: number;
}

export function ImportCALicenses() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats>({
    totalInserted: 0,
    totalSkippedTooOld: 0,
    totalSkippedInvalid: 0,
    totalErrors: 0,
    filesProcessed: 0,
    totalFiles: 0,
  });
  const [currentFile, setCurrentFile] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File, fileIndex: number, totalFiles: number) => {
    const text = await file.text();
    const lines = text.split('\n');
    const totalLines = lines.length;
    const batchSize = 5000;
    
    let currentLine = 0;
    let fileInserted = 0;
    let fileSkippedTooOld = 0;
    let fileSkippedInvalid = 0;
    let fileErrors = 0;

    setCurrentFile(file.name);

    while (currentLine < totalLines) {
      // Send batch to edge function
      const batchData = lines.slice(
        currentLine === 0 ? 0 : currentLine,
        currentLine + batchSize
      ).join('\n');

      // Include header if not first batch
      const csvData = currentLine === 0 ? batchData : lines[0] + '\n' + batchData;

      try {
        const { data, error } = await supabase.functions.invoke('import-ca-licenses', {
          body: { csvData, startLine: 0, batchSize: batchSize }
        });

        if (error) {
          console.error('Import error:', error);
          fileErrors += batchSize;
        } else {
          fileInserted += data.inserted || 0;
          fileSkippedTooOld += data.skippedTooOld || 0;
          fileSkippedInvalid += data.skippedInvalid || 0;
          fileErrors += data.errors || 0;
        }
      } catch (err) {
        console.error('Request error:', err);
        fileErrors += batchSize;
      }

      currentLine += batchSize;
      
      // Update progress
      const fileProgress = (currentLine / totalLines) * 100;
      const overallProgress = ((fileIndex + fileProgress / 100) / totalFiles) * 100;
      setProgress(Math.min(overallProgress, 100));
    }

    return { fileInserted, fileSkippedTooOld, fileSkippedInvalid, fileErrors };
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setProgress(0);
    setStats({
      totalInserted: 0,
      totalSkippedTooOld: 0,
      totalSkippedInvalid: 0,
      totalErrors: 0,
      filesProcessed: 0,
      totalFiles: files.length,
    });

    let grandTotalInserted = 0;
    let grandTotalSkippedTooOld = 0;
    let grandTotalSkippedInvalid = 0;
    let grandTotalErrors = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await processFile(file, i, files.length);
      
      grandTotalInserted += result.fileInserted;
      grandTotalSkippedTooOld += result.fileSkippedTooOld;
      grandTotalSkippedInvalid += result.fileSkippedInvalid;
      grandTotalErrors += result.fileErrors;

      setStats({
        totalInserted: grandTotalInserted,
        totalSkippedTooOld: grandTotalSkippedTooOld,
        totalSkippedInvalid: grandTotalSkippedInvalid,
        totalErrors: grandTotalErrors,
        filesProcessed: i + 1,
        totalFiles: files.length,
      });
    }

    setProgress(100);
    setIsImporting(false);
    setCurrentFile("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    toast.success(`Import complete! Inserted ${grandTotalInserted.toLocaleString()} CA licenses`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Import CA Licenses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload CA license CSV files. Licenses older than 40 years will be automatically filtered out.
        </p>

        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv"
            multiple
            onChange={handleImport}
            disabled={isImporting}
            ref={fileInputRef}
            className="hidden"
            id="ca-license-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImporting ? "Importing..." : "Select CSV Files"}
          </Button>
        </div>

        {isImporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing: {currentFile}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {(stats.totalInserted > 0 || stats.totalSkippedTooOld > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">{stats.totalInserted.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Inserted</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">{stats.totalSkippedTooOld.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Skipped (40+ yrs)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">{stats.totalSkippedInvalid.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Invalid</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">{stats.totalErrors.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
