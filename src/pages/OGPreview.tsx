import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Share2 } from "lucide-react";

export default function OGPreview() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [ogImageUrl, setOgImageUrl] = useState<string>("");

  // Search agents query
  const { data: searchResults } = useQuery({
    queryKey: ['agent-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, city_id, description, cities(name, state)')
        .eq('active', true)
        .ilike('name', `%${searchQuery}%`)
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const loadAgentPreview = async () => {
    if (!selectedAgentId) return;

    const agent = searchResults?.find(a => a.id === selectedAgentId);
    if (!agent) return;

    setSelectedAgent(agent);
    
    const cacheBust = Date.now();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image?id=${selectedAgentId}&v=${cacheBust}`;
    setOgImageUrl(url);
  };

  const handleCheckItOut = async () => {
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast.info("Please sign in to edit your profile");
      // Store the intended destination
      sessionStorage.setItem('returnTo', `/verify-listing/${selectedAgentId}`);
      navigate('/agent-setup');
    } else {
      navigate(`/verify-listing/${selectedAgentId}`);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Agent Preview</h1>
        <p className="text-muted-foreground">
          Find your agent profile and edit your listing
        </p>
      </div>

      {/* Search and Select Agent */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Agent to Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agent by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {searchResults && searchResults.length > 0 && (
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent to preview" />
              </SelectTrigger>
              <SelectContent>
                {searchResults.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={loadAgentPreview}
            disabled={!selectedAgentId}
            className="w-full"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Load Preview
          </Button>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {selectedAgent && ogImageUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Your Profile Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-1">{selectedAgent.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {selectedAgent.cities?.name}, {selectedAgent.cities?.state}
                </p>
                <img 
                  src={ogImageUrl} 
                  alt={`${selectedAgent.name} - Profile Preview`}
                  className="w-full rounded-lg border"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleCheckItOut}
              className="w-full bg-primary hover:bg-primary/90"
              size="lg"
            >
              Check It Out
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
