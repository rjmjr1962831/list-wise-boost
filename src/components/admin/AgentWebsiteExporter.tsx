import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AgentWebsiteExporter() {
  const [isExporting, setIsExporting] = useState(false);

  const exportAgentWebsites = async () => {
    setIsExporting(true);
    try {
      // Fetch all active agents with websites in batches due to 1000 row limit
      let allAgents: { first_name: string; last_name: string; website: string }[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('professionals')
          .select('name, website')
          .eq('active', true)
          .not('website', 'is', null)
          .neq('website', '')
          .neq('website', 'null')
          .order('name')
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        // Parse names into first/last
        const parsed = data.map(agent => {
          const nameParts = (agent.name || '').trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          return {
            first_name: firstName,
            last_name: lastName,
            website: agent.website || ''
          };
        });

        allAgents = [...allAgents, ...parsed];
        
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      if (allAgents.length === 0) {
        toast.error("No agents found with websites");
        return;
      }

      // Build CSV
      const headers = ['first_name', 'last_name', 'website'];
      const csvRows = [headers.join(',')];

      for (const agent of allAgents) {
        const row = [
          `"${(agent.first_name || '').replace(/"/g, '""')}"`,
          `"${(agent.last_name || '').replace(/"/g, '""')}"`,
          `"${(agent.website || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `arizona-agents-websites-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allAgents.length} agents with websites`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Website Export</CardTitle>
        <CardDescription>
          Export all active Arizona agents with their first name, last name, and professional website.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p><strong>Exported fields:</strong></p>
            <ul className="list-disc list-inside mt-1">
              <li>first_name</li>
              <li>last_name</li>
              <li>website</li>
            </ul>
          </div>
          <Button onClick={exportAgentWebsites} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Agent Websites CSV
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
