import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PhoneNumberRestorer() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [results, setResults] = useState<any>(null);

  const loadCSVFile = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/qualified-agents-crm.csv');
      if (!response.ok) {
        throw new Error('CSV file not found');
      }
      const text = await response.text();
      setCsvData(text);
      toast.success("CSV file loaded!", {
        description: `${text.split('\n').length - 1} rows ready to process`
      });
    } catch (error: any) {
      console.error("Failed to load CSV:", error);
      toast.error("Failed to load CSV file", {
        description: "Make sure qualified-agents-crm.csv exists in the public folder"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!csvData.trim()) {
      toast.error("Please paste CSV data first");
      return;
    }

    setIsRestoring(true);
    setResults(null);

    try {
      console.log("🔄 Starting phone number restoration...");
      
      const { data, error } = await supabase.functions.invoke('restore-phone-numbers', {
        body: { csvData }
      });

      if (error) throw error;

      // Verify database state after restoration
      console.log("🔍 Verifying phone numbers in database...");
      const { count: totalAgents } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true });
      
      const { count: agentsWithPhones } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .not('phone', 'is', null)
        .neq('phone', '');

      const verificationData = {
        ...data,
        total_agents: totalAgents || 0,
        agents_with_phones: agentsWithPhones || 0,
        agents_without_phones: (totalAgents || 0) - (agentsWithPhones || 0)
      };

      setResults(verificationData);
      
      toast.success(`✅ Restored ${data.phones_updated} phone numbers!`, {
        description: `${agentsWithPhones}/${totalAgents} agents now have phone numbers`
      });

    } catch (error: any) {
      console.error("Phone restoration error:", error);
      toast.error("Failed to restore phone numbers", {
        description: error.message
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Restore Phone Numbers from CSV
        </CardTitle>
        <CardDescription>
          Upload CSV data to restore phone numbers. Email addresses will NOT be changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={loadCSVFile} 
            disabled={isLoading}
            variant="outline"
            className="flex-1"
          >
            {isLoading ? (
              <>Loading...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Load CSV from File
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">CSV Data:</label>
          <Textarea
            placeholder="Click 'Load CSV from File' to auto-load, or paste CSV data manually..."
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
          {csvData && (
            <p className="text-xs text-muted-foreground">
              {csvData.split('\n').length - 1} rows loaded
            </p>
          )}
        </div>

        <Button 
          onClick={handleRestore} 
          disabled={isRestoring || !csvData.trim()}
          className="w-full"
        >
          {isRestoring ? (
            <>Processing...</>
          ) : (
            <>
              <Phone className="mr-2 h-4 w-4" />
              Restore Phone Numbers
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="text-2xl font-bold">{results.phones_updated}</div>
                      <div className="text-sm text-muted-foreground">Phones Updated</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="text-2xl font-bold">{results.agents_with_phones}/{results.total_agents}</div>
                      <div className="text-sm text-muted-foreground">Have Phone Numbers</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <div>
                      <div className="text-2xl font-bold">{results.agents_not_found.length}</div>
                      <div className="text-sm text-muted-foreground">Not Found</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {results.updated_agents && results.updated_agents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Updated Agents</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {results.updated_agents.map((agent: any, idx: number) => (
                        <div key={idx} className="text-sm border-b pb-2">
                          <div className="font-medium">{agent.name} ({agent.city})</div>
                          <div className="text-muted-foreground">
                            Phone: {agent.phone}
                          </div>
                          <div className="text-xs text-green-600">
                            ✓ Email preserved: {agent.email_preserved || 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {results.agents_not_found && results.agents_not_found.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Agents Not Found</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-1">
                      {results.agents_not_found.map((agent: string, idx: number) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          • {agent}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
