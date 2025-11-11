import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, CheckCircle2, XCircle } from "lucide-react";
import { stateLicenseLookups } from "@/data/stateLicenseLookups";

interface TestResult {
  agentName: string;
  state: string;
  licenseNumber: string | null;
  success: boolean;
  message: string;
  timestamp: Date;
}

const testAgents = [
  { name: "Julie Goodwin", state: "Arizona", stateAbbr: "AZ" },
  { name: "Michael Chen", state: "California", stateAbbr: "CA" },
  { name: "Sarah Johnson", state: "Texas", stateAbbr: "TX" },
  { name: "David Park", state: "Florida", stateAbbr: "FL" },
  { name: "Emily Foster", state: "New York", stateAbbr: "NY" },
];

export function LicenseLookupTester() {
  const [agentName, setAgentName] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const testLookup = async (name: string, state: string) => {
    const stateInfo = stateLicenseLookups.find(
      s => s.state.toLowerCase() === state.toLowerCase()
    );
    
    if (!stateInfo) {
      toast.error(`No license lookup URL found for ${state}`);
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('lookup-agent-license', {
        body: {
          agentName: name,
          state: state,
          licensePortalUrl: stateInfo.url
        }
      });

      if (error) throw error;

      return {
        agentName: name,
        state: state,
        licenseNumber: data.licenseNumber,
        success: data.success,
        message: data.message,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('License lookup error:', error);
      return {
        agentName: name,
        state: state,
        licenseNumber: null,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  };

  const handleTestSingle = async () => {
    if (!agentName || !selectedState) {
      toast.error("Please enter agent name and select a state");
      return;
    }

    setIsLoading(true);
    try {
      const result = await testLookup(agentName, selectedState);
      if (result) {
        setTestResults(prev => [result, ...prev]);
        if (result.success) {
          toast.success(`License found: ${result.licenseNumber}`);
        } else {
          toast.warning(result.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestMultiple = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      toast.info(`Testing ${testAgents.length} agents...`);
      
      for (const agent of testAgents) {
        const result = await testLookup(agent.name, agent.state);
        if (result) {
          setTestResults(prev => [...prev, result]);
        }
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      toast.success("Testing complete!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>License Lookup Tester</CardTitle>
          <CardDescription>
            Test the AI-powered license lookup with real agent names from different states
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Single Test */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Single Agent Test</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="agentName">Agent Name</Label>
                <Input
                  id="agentName"
                  placeholder="John Doe"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {stateLicenseLookups.map((state) => (
                      <SelectItem key={state.state} value={state.state}>
                        {state.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={handleTestSingle} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Test Lookup
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Multiple Test */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Batch Test (Pre-defined Agents)</h3>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Test with these agents:
              </p>
              <ul className="text-sm space-y-1 ml-4">
                {testAgents.map((agent, index) => (
                  <li key={index} className="list-disc">
                    <span className="font-medium">{agent.name}</span> - {agent.state} ({agent.stateAbbr})
                  </li>
                ))}
              </ul>
            </div>
            <Button 
              onClick={handleTestMultiple} 
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Batch Test...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Run Batch Test
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              {testResults.filter(r => r.success).length} of {testResults.length} successful
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.success 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {result.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        )}
                        <h4 className="font-semibold">{result.agentName}</h4>
                        <span className="text-sm text-muted-foreground">- {result.state}</span>
                      </div>
                      
                      {result.success && result.licenseNumber && (
                        <div className="ml-7 space-y-1">
                          <p className="text-sm">
                            <span className="font-medium">License Number:</span>{" "}
                            <code className="px-2 py-1 bg-background rounded text-sm font-mono">
                              {result.licenseNumber}
                            </code>
                          </p>
                        </div>
                      )}
                      
                      <p className="ml-7 text-sm text-muted-foreground mt-1">
                        {result.message}
                      </p>
                      
                      <p className="ml-7 text-xs text-muted-foreground mt-2">
                        {result.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
