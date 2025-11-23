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
  const [csvData, setCsvData] = useState("");
  const [results, setResults] = useState<any>(null);

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

      setResults(data);
      
      toast.success(`✅ Restored ${data.phones_updated} phone numbers!`, {
        description: `Found ${data.agents_found} agents, ${data.agents_not_found.length} not found`
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
        <div className="space-y-2">
          <label className="text-sm font-medium">Paste CSV Data:</label>
          <Textarea
            placeholder="Name,Brokerage,City,State,Rank,Email,Phone,Website,Rating,Reviews&#10;John Doe,Realty Co,Phoenix,Arizona,1,john@example.com,(480) 555-1234,..."
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
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
              <Upload className="mr-2 h-4 w-4" />
              Restore Phone Numbers
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-4">
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
