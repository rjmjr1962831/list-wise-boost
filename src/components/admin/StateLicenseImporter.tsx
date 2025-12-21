import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";

const STATES = [
  { code: "TX", name: "Texas" },
  { code: "CA", name: "California" },
  { code: "FL", name: "Florida" },
  { code: "CO", name: "Colorado" },
  { code: "NY", name: "New York" },
];

const CHUNK_SIZE = 5000;

export const StateLicenseImporter = () => {
  const [selectedState, setSelectedState] = useState<string>("");
  const [fileData, setFileData] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    imported: number;
    errors: number;
  } | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileData(text);
      
      const lines = text.split('\n').filter(line => line.trim()).length;
      toast.success(`File loaded: ${lines.toLocaleString()} lines`);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!fileData || !selectedState) {
      toast.error("Please select a state and upload a file");
      return;
    }

    setImporting(true);
    const lines = fileData.split('\n').filter(line => line.trim());
    const totalLines = lines.length;
    const totalChunks = Math.ceil(totalLines / CHUNK_SIZE);

    setProgress({ current: 0, total: totalLines, imported: 0, errors: 0 });

    let totalImported = 0;
    let totalErrors = 0;

    try {
      for (let chunk = 0; chunk < totalChunks; chunk++) {
        const startLine = chunk === 0 ? 1 : chunk * CHUNK_SIZE;
        const endLine = Math.min((chunk + 1) * CHUNK_SIZE, totalLines);

        console.log(`Processing chunk ${chunk + 1}/${totalChunks}: lines ${startLine}-${endLine}`);

        const { data, error } = await supabase.functions.invoke('import-state-licenses', {
          body: {
            csvData: fileData,
            state: selectedState,
            startLine,
            endLine,
          },
        });

        if (error) {
          console.error('Chunk error:', error);
          totalErrors += CHUNK_SIZE;
        } else if (data) {
          totalImported += data.imported || 0;
          totalErrors += data.errors || 0;
        }

        setProgress({
          current: endLine,
          total: totalLines,
          imported: totalImported,
          errors: totalErrors,
        });
      }

      toast.success(`Import complete: ${totalImported.toLocaleString()} licenses imported`);
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  const progressPercent = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          State License Importer
        </CardTitle>
        <CardDescription>
          Import license data for TX, CA, FL, CO, and NY into the state_licenses table for agent verification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-2 block">Select State</label>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger>
                <SelectValue placeholder="Choose state..." />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name} ({state.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
              disabled={importing}
            />
          </div>
        </div>

        {fileData && selectedState && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Ready to import {selectedState} licenses
          </div>
        )}

        {progress && (
          <div className="space-y-2">
            <Progress value={progressPercent} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {progress.current.toLocaleString()} / {progress.total.toLocaleString()} lines
              </span>
              <span>
                {progress.imported.toLocaleString()} imported, {progress.errors.toLocaleString()} errors
              </span>
            </div>
          </div>
        )}

        <Button 
          onClick={handleImport} 
          disabled={!fileData || !selectedState || importing}
          className="w-full"
        >
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Import Licenses
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Expected CSV format: state, license_number, name, city (optional), license_type
        </p>
      </CardContent>
    </Card>
  );
};
