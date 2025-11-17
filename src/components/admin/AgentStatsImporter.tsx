import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertCircle, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImportPreview {
  id: string;
  name: string;
  zuid?: string;
  zillow_profile_url?: string;
  current_listings?: number;
  total_sales?: number;
  years_experience?: number;
  zip_code?: string;
}

export function AgentStatsImporter() {
  const [csvData, setCsvData] = useState("");
  const [jsonData, setJsonData] = useState("");
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const parseCSV = (csv: string): ImportPreview[] => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data: ImportPreview[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, idx) => {
        const value = values[idx];
        if (header === 'current_listings' || header === 'total_sales' || header === 'years_experience') {
          row[header] = value ? parseInt(value, 10) : undefined;
        } else {
          row[header] = value || undefined;
        }
      });
      
      if (row.id && row.name) {
        data.push(row as ImportPreview);
      }
    }
    
    return data;
  };

  const parseJSON = (json: string): ImportPreview[] => {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return [];
    }
  };

  const validateData = (data: ImportPreview[]): string[] => {
    const errors: string[] = [];
    
    if (data.length === 0) {
      errors.push("No valid data found");
      return errors;
    }
    
    data.forEach((row, idx) => {
      if (!row.id) errors.push(`Row ${idx + 1}: Missing 'id' field`);
      if (!row.name) errors.push(`Row ${idx + 1}: Missing 'name' field`);
      if (row.current_listings !== undefined && (row.current_listings < 0 || !Number.isFinite(row.current_listings))) {
        errors.push(`Row ${idx + 1}: Invalid 'current_listings' value`);
      }
      if (row.total_sales !== undefined && (row.total_sales < 0 || !Number.isFinite(row.total_sales))) {
        errors.push(`Row ${idx + 1}: Invalid 'total_sales' value`);
      }
    });
    
    return errors;
  };

  const handlePreview = (format: 'csv' | 'json') => {
    const rawData = format === 'csv' ? csvData : jsonData;
    if (!rawData.trim()) {
      setValidationErrors(["Please paste data first"]);
      setPreview([]);
      return;
    }
    
    const parsed = format === 'csv' ? parseCSV(rawData) : parseJSON(rawData);
    const errors = validateData(parsed);
    
    setValidationErrors(errors);
    setPreview(errors.length === 0 ? parsed : []);
  };

  const handleExport = async () => {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, zuid, zillow_profile_url, current_listings, total_sales, years_experience, zip_code')
        .order('name');

      if (error) throw error;

      const headers = ['id', 'name', 'zuid', 'zillow_profile_url', 'current_listings', 'total_sales', 'years_experience', 'zip_code'];
      const csvRows = [headers.join(',')];

      data?.forEach(row => {
        const values = [
          row.id,
          row.name,
          row.zuid || '',
          row.zillow_profile_url || '',
          row.current_listings ?? '',
          row.total_sales ?? '',
          row.years_experience ?? '',
          row.zip_code || ''
        ];
        csvRows.push(values.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-stats-template-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${data?.length || 0} records`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed");
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    
    setImporting(true);
    try {
      const updates = preview.map(row => ({
        id: row.id,
        ...(row.zuid && { zuid: row.zuid }),
        ...(row.zillow_profile_url && { zillow_profile_url: row.zillow_profile_url }),
        ...(row.current_listings !== undefined && { current_listings: row.current_listings }),
        ...(row.total_sales !== undefined && { total_sales: row.total_sales }),
        ...(row.years_experience !== undefined && { years_experience: row.years_experience }),
        ...(row.zip_code && { zip_code: row.zip_code }),
        zillow_data_fetched_at: new Date().toISOString()
      }));

      let successCount = 0;
      let errorCount = 0;

      for (const update of updates) {
        const { error } = await supabase
          .from('professionals')
          .update(update)
          .eq('id', update.id);
        
        if (error) {
          console.error(`Failed to update ${update.id}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      toast.success(`Import complete: ${successCount} updated, ${errorCount} errors`);
      
      if (errorCount === 0) {
        setCsvData("");
        setJsonData("");
        setPreview([]);
        setValidationErrors([]);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Agent Stats
            </CardTitle>
            <CardDescription>
              Bulk update agent statistics from CSV or JSON data. Required fields: id, name. Optional: zuid, zillow_profile_url, current_listings, total_sales, years_experience, zip_code.
            </CardDescription>
          </div>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="csv">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="csv">CSV Format</TabsTrigger>
            <TabsTrigger value="json">JSON Format</TabsTrigger>
          </TabsList>
          
          <TabsContent value="csv" className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Paste CSV Data</label>
              <Textarea
                placeholder="id,name,zuid,zillow_profile_url,current_listings,total_sales,years_experience,zip_code&#10;abc-123,John Doe,johndoe,https://zillow.com/profile/johndoe,5,120,15,85001"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
            <Button onClick={() => handlePreview('csv')} variant="outline" className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              Validate & Preview
            </Button>
          </TabsContent>
          
          <TabsContent value="json" className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Paste JSON Data</label>
              <Textarea
                placeholder='[{"id":"abc-123","name":"John Doe","zuid":"johndoe","zillow_profile_url":"https://zillow.com/profile/johndoe","current_listings":5,"total_sales":120,"years_experience":15,"zip_code":"85001"}]'
                value={jsonData}
                onChange={(e) => setJsonData(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
            <Button onClick={() => handlePreview('json')} variant="outline" className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              Validate & Preview
            </Button>
          </TabsContent>
        </Tabs>

        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-1">Validation Errors:</div>
              <ul className="list-disc list-inside text-xs space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {preview.length > 0 && (
          <div className="space-y-3">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold">Ready to import {preview.length} records</div>
              </AlertDescription>
            </Alert>
            
            <div className="border rounded-lg p-3 bg-muted/30 max-h-60 overflow-auto">
              <div className="text-xs font-mono space-y-2">
                {preview.slice(0, 5).map((row, idx) => (
                  <div key={idx} className="border-b pb-2 last:border-0">
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-muted-foreground">
                      ID: {row.id} | Listings: {row.current_listings ?? 'N/A'} | Sales: {row.total_sales ?? 'N/A'}
                    </div>
                  </div>
                ))}
                {preview.length > 5 && (
                  <div className="text-muted-foreground text-center pt-2">
                    ... and {preview.length - 5} more
                  </div>
                )}
              </div>
            </div>

            <Button 
              onClick={handleImport} 
              disabled={importing}
              className="w-full"
            >
              {importing ? "Importing..." : `Import ${preview.length} Records`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
