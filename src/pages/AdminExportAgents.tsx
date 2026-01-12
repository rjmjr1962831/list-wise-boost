import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, FileJson, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const AdminExportAgents = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const { toast } = useToast();

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-active-agents', {
        body: { format }
      });

      if (error) {
        throw new Error(error.message || 'Failed to export agents');
      }

      // Create blob and download
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `active_agents_${today}.${format}`;
      
      let blob: Blob;
      if (format === 'csv') {
        blob = new Blob([data], { type: 'text/csv' });
      } else {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Downloaded ${data.total_count || 'unknown'} agents as ${filename}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/admin" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Admin Dashboard
        </Link>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Active Agents
            </CardTitle>
            <CardDescription>
              Export all active agents with Zillow UIDs from the professionals table.
              Includes first name, last name, Zillow UID, and Zillow URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium">Export Format</label>
              <div className="flex gap-3">
                <Button
                  variant={format === 'json' ? 'default' : 'outline'}
                  onClick={() => setFormat('json')}
                  className="flex items-center gap-2"
                >
                  <FileJson className="w-4 h-4" />
                  JSON
                </Button>
                <Button
                  variant={format === 'csv' ? 'default' : 'outline'}
                  onClick={() => setFormat('csv')}
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </Button>
              </div>
            </div>

            <Button 
              onClick={handleExport} 
              disabled={isLoading}
              size="lg"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Active Agents
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              File will be named: active_agents_YYYYMMDD.{format}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminExportAgents;
