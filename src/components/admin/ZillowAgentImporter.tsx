import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ZillowAgentImporter = () => {
  const [city, setCity] = useState("");
  const [state, setState] = useState("AZ");
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [importingIds, setImportingIds] = useState<Set<number>>(new Set());
  const [cities, setCities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchCitiesAndCategories();
  }, []);

  const fetchCitiesAndCategories = async () => {
    try {
      const [citiesResult, categoriesResult] = await Promise.all([
        supabase.from('cities').select('*').eq('active', true).order('name'),
        supabase.from('categories').select('*').eq('active', true).order('name')
      ]);

      if (citiesResult.data) setCities(citiesResult.data);
      if (categoriesResult.data) setCategories(categoriesResult.data);
    } catch (error) {
      console.error('Error fetching cities and categories:', error);
    }
  };

  const fetchAgents = async () => {
    if (!city.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a city name",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCityId || !selectedCategoryId) {
      toast({
        title: "Missing Mapping",
        description: "Please select both city and category before fetching",
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

  const importAgent = async (agent: any, index: number) => {
    setImportingIds(prev => new Set(prev).add(index));
    
    try {
      // Get the next rank for this city/category combination
      const { data: existingPros, error: rankError } = await supabase
        .from('professionals')
        .select('rank')
        .eq('city_id', selectedCityId)
        .eq('category_id', selectedCategoryId)
        .order('rank', { ascending: false })
        .limit(1);

      if (rankError) throw rankError;

      const nextRank = existingPros && existingPros.length > 0 ? existingPros[0].rank + 1 : 1;

      // Map Zillow data to our professional structure
      const professionalData = {
        name: agent.name || agent.fullName || "Unknown Agent",
        company: agent.businessName || agent.brokerageName || null,
        phone: agent.phone || agent.phoneNumber || null,
        email: agent.email || null,
        website: agent.profileUrl || agent.website || null,
        image_url: agent.photo || agent.photoUrl || agent.image || null,
        specialty: agent.specialties || [],
        years_experience: agent.yearsOfExperience || agent.experience || null,
        license_number: agent.licenseNumber || null,
        description: agent.description || agent.bio || null,
        city_id: selectedCityId,
        category_id: selectedCategoryId,
        type: 'emerging',
        rank: nextRank,
        active: true,
      };

      console.log('Importing agent:', professionalData);

      const { error: insertError } = await supabase
        .from('professionals')
        .insert([professionalData]);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: `${professionalData.name} imported successfully`,
      });

      // Remove the agent from the list after successful import
      setAgents(prev => prev.filter((_, i) => i !== index));
      
    } catch (error) {
      console.error('Error importing agent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to import agent",
        variant: "destructive",
      });
    } finally {
      setImportingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
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
            <Label htmlFor="city">City to Search</Label>
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cityMap">Map to City</Label>
            <Select value={selectedCityId} onValueChange={setSelectedCityId}>
              <SelectTrigger id="cityMap">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}, {city.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoryMap">Map to Category</Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger id="categoryMap">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="font-semibold">
                          {agent.name || agent.fullName || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {agent.businessName || agent.brokerageName}
                        </p>
                        {agent.phone && (
                          <p className="text-sm">{agent.phone}</p>
                        )}
                        {agent.email && (
                          <p className="text-sm text-muted-foreground">{agent.email}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => importAgent(agent, index)}
                        disabled={importingIds.has(index)}
                      >
                        {importingIds.has(index) ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Import
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Agents will be imported to: <span className="font-semibold">
                  {cities.find(c => c.id === selectedCityId)?.name || 'N/A'}, {categories.find(c => c.id === selectedCategoryId)?.name || 'N/A'}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Imported agents will appear at the end of the list
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
