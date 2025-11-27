import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, CheckCircle, Database } from 'lucide-react';

export const ArizonaLicenseImporter = () => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ imported: number; total: number; errors: number } | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileData(text);
      const lines = text.split('\n').length - 1;
      toast.success(`File loaded: ${file.name} (${lines.toLocaleString()} licenses, ${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!fileData) {
      toast.error('Please select a CSV file first');
      return;
    }

    setImporting(true);
    setProgress(null);

    try {
      console.log('Starting import to arizona_licenses table...');
      
      const { data, error } = await supabase.functions.invoke('import-arizona-licenses', {
        body: { csvData: fileData }
      });

      if (error) throw error;

      setProgress(data);
      toast.success(
        `Import complete! ${data.imported.toLocaleString()} licenses imported${data.errors > 0 ? `, ${data.errors} errors` : ''}`,
        { duration: 5000 }
      );
      
      console.log('Import results:', data);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Arizona License Database Importer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Import the Arizona real estate license CSV file into the <code className="bg-muted px-1 py-0.5 rounded">arizona_licenses</code> database table.
          This enables instant license verification with indexed database queries instead of slow file parsing.
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>221K+ license records stored in database</li>
            <li>Fast indexed lookups by license number</li>
            <li>Automatic years of experience calculation</li>
            <li>One-time import, used forever</li>
          </ul>
        </div>

        <div>
          <label className="block mb-2 font-medium text-sm">
            Select arizona-licenses.csv file
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={importing}
            className="block w-full text-sm text-muted-foreground
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-primary file:text-primary-foreground
              hover:file:bg-primary/90
              file:cursor-pointer cursor-pointer"
          />
        </div>

        {fileData && !importing && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            <CheckCircle className="h-4 w-4" />
            <span>File ready to import ({(fileData.length / 1024 / 1024).toFixed(2)} MB)</span>
          </div>
        )}

        {progress && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="text-sm font-medium">Import Results:</div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Imported:</span>
                <div className="font-bold text-lg text-green-600">{progress.imported.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Total:</span>
                <div className="font-bold text-lg">{progress.total.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Errors:</span>
                <div className="font-bold text-lg text-red-600">{progress.errors.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={!fileData || importing}
          className="w-full"
        >
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing licenses to database...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Import to Database
            </>
          )}
        </Button>

        {!progress && !importing && (
          <p className="text-xs text-muted-foreground">
            Note: This imports the CSV data once into the database. After importing, license verification will be instant via database queries.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
