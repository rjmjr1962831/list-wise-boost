import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download } from "lucide-react";

export const ZillowAgentImporter = () => {
  const [city, setCity] = useState("");
  const [state, setState] = useState("AZ");
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchAgents = async () => {
    if (!city.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a city name",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-zillow-agents', {
        body: { city: city.trim(), state: state.trim() }
      });

      if (error) throw error;

      console.log('Zillow API response:', data);
      
      // The structure will depend on your specific RapidAPI endpoint
      // Adjust this parsing based on the actual response format
      const agentList = Array.isArray(data) ? data : data.agents || data.results || [];
      
      setAgents(agentList);
      toast({
        title: "Success",
        description: `Found ${agentList.length} agents`,
      });
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch agents from Zillow",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const importAgent = async (agent: any) => {
    try {
      // Map Zillow data to our professional structure
      // Adjust field mapping based on actual Zillow API response
      const professionalData = {
        name: agent.name || agent.fullName || "Unknown",
        business_name: agent.businessName || agent.brokerageName || null,
        phone: agent.phone || agent.phoneNumber || null,
        email: agent.email || null,
        website: agent.profileUrl || agent.website || null,
        photo_url: agent.photo || agent.photoUrl || null,
        specialties: agent.specialties || [],
        years_experience: agent.yearsOfExperience || null,
        license_number: agent.licenseNumber || null,
        profile_description: agent.description || agent.bio || null,
        // You'll need to map to actual city_id and category_id from your database
      };

      console.log('Importing agent:', professionalData);
      
      toast({
        title: "Agent Data Ready",
        description: `${professionalData.name} - Please review and save manually`,
      });
      
      // For now, just log the data. You can extend this to auto-insert
      // or open a modal with pre-filled form for review
      
    } catch (error) {
      console.error('Error importing agent:', error);
      toast({
        title: "Error",
        description: "Failed to import agent",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zillow Agent Importer</CardTitle>
        <CardDescription>
          Search for agents on Zillow and import their data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Gilbert"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              placeholder="AZ"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
        </div>

        <Button 
          onClick={fetchAgents} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching Agents...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Fetch Agents from Zillow
            </>
          )}
        </Button>

        {agents.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Found {agents.length} Agents
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {agents.map((agent, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {agent.name || agent.fullName || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {agent.businessName || agent.brokerageName}
                        </p>
                        {agent.phone && (
                          <p className="text-sm">{agent.phone}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => importAgent(agent)}
                      >
                        Review Import
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Note: Review the API response structure in console to adjust field mappings
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
