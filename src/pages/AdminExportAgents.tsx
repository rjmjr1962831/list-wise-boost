import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ExportFilter = "active" | "qualified";

const AdminExportAgents = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [filter, setFilter] = useState<ExportFilter>("qualified");
  const { toast } = useToast();

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-active-agents", {
        body: { format, filter },
      });

      if (error) {
        throw new Error(error.message || "Failed to export agents");
      }

      // Create blob and download
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const filename = `agents_${filter}_${today}.${format}`;

      let blob: Blob;
      if (format === "csv") {
        blob = new Blob([data], { type: "text/csv" });
      } else {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Downloaded ${data?.total_count ?? "unknown"} agents as ${filename}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
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
              Export Agents
            </CardTitle>
            <CardDescription>
              Export agents from the professionals table. Choose whether to export all active agents or only qualified agents (4.5+
              rating & 10+ reviews in last 24 months).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Agent Filter</Label>
              <RadioGroup value={filter} onValueChange={(value) => setFilter(value as ExportFilter)} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="active" id="filter-active" />
                  <Label htmlFor="filter-active" className="font-normal cursor-pointer">
                    All active
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="qualified" id="filter-qualified" />
                  <Label htmlFor="filter-qualified" className="font-normal cursor-pointer">
                    Qualified (4.5+ rating, 10+ reviews in last 24 months)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Format</Label>
              <div className="flex gap-3">
                <Button
                  variant={format === "json" ? "default" : "outline"}
                  onClick={() => setFormat("json")}
                  className="flex items-center gap-2"
                >
                  <FileJson className="w-4 h-4" />
                  JSON
                </Button>
                <Button
                  variant={format === "csv" ? "default" : "outline"}
                  onClick={() => setFormat("csv")}
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </Button>
              </div>
            </div>

            <Button onClick={handleExport} disabled={isLoading} size="lg" className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Agents
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">File will be named: agents_{filter}_YYYYMMDD.{format}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminExportAgents;

