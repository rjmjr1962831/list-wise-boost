import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, ExternalLink, Copy, Share2, Edit } from "lucide-react";

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

  const agentUrl = selectedAgent 
    ? `${window.location.origin}/top10realestateagents/${selectedAgent.cities?.name.toLowerCase().replace(/\s+/g, '-')}-${selectedAgent.cities?.state.toLowerCase()}`
    : "";

  const copyMetaTags = () => {
    const metaTags = `
<meta property="og:title" content="${selectedAgent?.name} - Top Real Estate Agent" />
<meta property="og:description" content="${selectedAgent?.description?.substring(0, 200) || 'Premier real estate services'}" />
<meta property="og:image" content="${ogImageUrl}" />
<meta property="og:url" content="${agentUrl}" />
<meta property="og:type" content="profile" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${selectedAgent?.name} - Top Real Estate Agent" />
<meta name="twitter:description" content="${selectedAgent?.description?.substring(0, 200) || 'Premier real estate services'}" />
<meta name="twitter:image" content="${ogImageUrl}" />
    `.trim();

    navigator.clipboard.writeText(metaTags);
    toast.success("Meta tags copied to clipboard!");
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
        <h1 className="text-4xl font-bold mb-2">OG Preview Tester</h1>
        <p className="text-muted-foreground">
          Test how your Open Graph images and metadata will appear on social media platforms
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
        <>
          {/* Agent Info */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{selectedAgent.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedAgent.cities?.name}, {selectedAgent.cities?.state}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyMetaTags}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Meta Tags
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleCheckItOut}
                      className="bg-[#40E0D0] hover:bg-[#38CAB8] text-black font-semibold"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Check It Out
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Profile URL:</span>
                  <a 
                    href={agentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    {agentUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media Previews */}
          <Tabs defaultValue="facebook" className="mb-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="facebook">Facebook</TabsTrigger>
              <TabsTrigger value="twitter">Twitter/X</TabsTrigger>
              <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            </TabsList>

            {/* Facebook Preview */}
            <TabsContent value="facebook">
              <Card>
                <CardHeader>
                  <CardTitle>Facebook Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <img 
                      src={ogImageUrl} 
                      alt="OG Preview" 
                      className="w-full h-auto"
                    />
                    <div className="p-3 border-t bg-gray-50">
                      <p className="text-xs text-gray-500 uppercase mb-1">top10lists.us</p>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {selectedAgent.name} - Top Real Estate Agent
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {selectedAgent.description || 'Premier real estate services'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Twitter Preview */}
            <TabsContent value="twitter">
              <Card>
                <CardHeader>
                  <CardTitle>Twitter/X Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-xl overflow-hidden bg-white max-w-[504px]">
                    <img 
                      src={ogImageUrl} 
                      alt="OG Preview" 
                      className="w-full h-auto"
                    />
                    <div className="p-3 border-t">
                      <p className="text-xs text-gray-500 mb-1">top10lists.us</p>
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">
                        {selectedAgent.name} - Top Real Estate Agent
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-1">
                        {selectedAgent.description || 'Premier real estate services'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LinkedIn Preview */}
            <TabsContent value="linkedin">
              <Card>
                <CardHeader>
                  <CardTitle>LinkedIn Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <img 
                      src={ogImageUrl} 
                      alt="OG Preview" 
                      className="w-full h-auto"
                    />
                    <div className="p-4 border-t bg-gray-50">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {selectedAgent.name} - Top Real Estate Agent
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">top10lists.us</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Validation Tools */}
          <Card>
            <CardHeader>
              <CardTitle>Validation & Testing Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  asChild
                  className="justify-start"
                >
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(agentUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Test on Facebook Debugger
                  </a>
                </Button>

                <Button
                  variant="outline"
                  asChild
                  className="justify-start"
                >
                  <a
                    href={`https://cards-dev.twitter.com/validator`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Twitter Card Validator
                  </a>
                </Button>

                <Button
                  variant="outline"
                  asChild
                  className="justify-start"
                >
                  <a
                    href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(agentUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    LinkedIn Post Inspector
                  </a>
                </Button>

                <Button
                  variant="outline"
                  asChild
                  className="justify-start"
                >
                  <a
                    href={`https://opengraphcheck.com/result.php?url=${encodeURIComponent(agentUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    OpenGraph Check
                  </a>
                </Button>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2">Direct OG Image URL:</h4>
                <div className="flex gap-2">
                  <Input 
                    value={ogImageUrl} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(ogImageUrl);
                      toast.success("Image URL copied!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
