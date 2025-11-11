import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import placeholderAgent from "@/assets/placeholder-agent.jpg";

// Mock data for testing
const MOCK_GILBERT_AGENTS = [
  {
    name: "Sarah Johnson",
    screenName: "Sarah Johnson",
    businessName: "Keller Williams Realty",
    phoneNumbers: {
      cell: "(480) 555-0123",
      business: "(480) 555-0124",
      brokerage: null
    },
    email: "sarah.johnson@kwaz.com",
    profilePhotoSrc: "https://photos.zillowstatic.com/fp/placeholder-agent.jpg",
    url: "https://www.zillow.com/profile/sarah-johnson",
    businessAddress: {
      address1: "123 Main Street",
      city: "Gilbert",
      state: "AZ",
      postalCode: "85296"
    },
    ratings: {
      count: 42,
      average: 4.8
    },
    specialties: ["Luxury Homes", "First-Time Buyers"],
    yearsOfExperience: 12,
    description: "Specializing in Gilbert luxury homes with over a decade of experience."
  },
  {
    name: "Michael Chen",
    screenName: "Michael Chen",
    businessName: "RE/MAX Fine Properties",
    phoneNumbers: {
      cell: "(480) 555-0456",
      business: "(480) 555-0457",
      brokerage: null
    },
    email: "mchen@remax.com",
    profilePhotoSrc: "https://photos.zillowstatic.com/fp/placeholder-agent.jpg",
    url: "https://www.zillow.com/profile/michael-chen",
    businessAddress: {
      address1: "456 Oak Avenue",
      city: "Gilbert",
      state: "AZ",
      postalCode: "85295"
    },
    ratings: {
      count: 28,
      average: 4.9
    },
    specialties: ["Relocation", "Investment Properties"],
    yearsOfExperience: 8,
    description: "Expert in relocation and investment properties in the Gilbert area."
  },
  {
    name: "Jennifer Martinez",
    screenName: "Jennifer Martinez",
    businessName: "HomeSmart",
    phoneNumbers: {
      cell: "(480) 555-0789",
      business: null,
      brokerage: "(480) 555-0790"
    },
    email: "jennifer@homesmart.com",
    profilePhotoSrc: "https://photos.zillowstatic.com/fp/placeholder-agent.jpg",
    url: "https://www.zillow.com/profile/jennifer-martinez",
    businessAddress: {
      address1: "789 Pine Road",
      city: "Gilbert",
      state: "AZ",
      postalCode: "85297"
    },
    ratings: {
      count: 56,
      average: 5.0
    },
    specialties: ["New Construction", "Family Homes"],
    yearsOfExperience: 15,
    description: "Helping families find their dream homes in Gilbert since 2008."
  },
  {
    name: "David Thompson",
    screenName: "David Thompson",
    businessName: "Coldwell Banker Realty",
    phoneNumbers: {
      cell: "(480) 555-0321",
      business: "(480) 555-0322",
      brokerage: null
    },
    email: "dthompson@coldwellbanker.com",
    profilePhotoSrc: "https://photos.zillowstatic.com/fp/placeholder-agent.jpg",
    url: "https://www.zillow.com/profile/david-thompson",
    businessAddress: {
      address1: "321 Elm Street",
      city: "Gilbert",
      state: "AZ",
      postalCode: "85234"
    },
    ratings: {
      count: 35,
      average: 4.7
    },
    specialties: ["Commercial", "Residential"],
    yearsOfExperience: 10,
    description: "Full-service real estate agent serving Gilbert and surrounding areas."
  },
  {
    name: "Lisa Anderson",
    screenName: "Lisa Anderson",
    businessName: "Russ Lyon Sotheby's",
    phoneNumbers: {
      cell: "(480) 555-0654",
      business: "(480) 555-0655",
      brokerage: null
    },
    email: "landerson@russlyon.com",
    profilePhotoSrc: "https://photos.zillowstatic.com/fp/placeholder-agent.jpg",
    url: "https://www.zillow.com/profile/lisa-anderson",
    businessAddress: {
      address1: "654 Maple Drive",
      city: "Gilbert",
      state: "AZ",
      postalCode: "85298"
    },
    ratings: {
      count: 89,
      average: 4.9
    },
    specialties: ["Estate Sales", "Luxury Properties"],
    yearsOfExperience: 18,
    description: "Premier luxury real estate specialist in the East Valley."
  }
];

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
  const [testMode, setTestMode] = useState(false);
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
      let agentList = [];
      
      if (testMode) {
        // Use mock data in test mode
        console.log('Using mock Gilbert agents data');
        agentList = MOCK_GILBERT_AGENTS;
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // Real API call
        const { data, error } = await supabase.functions.invoke('fetch-zillow-agents', {
          body: { city: city.trim(), state: state.trim() }
        });

        if (error) throw error;

        console.log('Zillow API response:', data);
        console.log('Response type:', typeof data);
        console.log('Is array?', Array.isArray(data));
        console.log('Keys:', Object.keys(data || {}));
        
        // The structure will depend on your specific RapidAPI endpoint
        // Adjust this parsing based on the actual response format
        agentList = Array.isArray(data) ? data : data.agents || data.results || data.data || [];
        
        console.log('Parsed agent list:', agentList);
        console.log('First agent:', agentList[0]);
      }
      
      setAgents(agentList);
      toast({
        title: "Success",
        description: `Found ${agentList.length} agents${testMode ? ' (Test Mode)' : ''}`,
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

      // Get agent photo or use placeholder
      let imageUrl = agent.profilePhotoSrc || agent.photo || agent.photoUrl || agent.image || null;
      
      // If no photo from Zillow, upload placeholder to storage
      if (!imageUrl) {
        try {
          // Fetch the placeholder image
          const response = await fetch(placeholderAgent);
          const blob = await response.blob();
          
          // Generate unique filename
          const fileName = `placeholder-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          
          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('professional-photos')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('professional-photos')
            .getPublicUrl(fileName);

          imageUrl = publicUrl;
        } catch (uploadErr) {
          console.error('Error uploading placeholder:', uploadErr);
          // Continue without image if upload fails
        }
      }

      // Build website URL - handle both relative and absolute URLs
      let websiteUrl = null;
      if (agent.profileLink) {
        websiteUrl = agent.profileLink.startsWith('http') 
          ? agent.profileLink 
          : `https://www.zillow.com${agent.profileLink}`;
      }

      // Map Zillow data to our professional structure
      const professionalData = {
        name: agent.fullName || "Unknown Agent",
        company: agent.businessName || null,
        phone: agent.phoneNumber || null,
        email: null, // API doesn't provide email
        website: websiteUrl,
        image_url: imageUrl,
        specialty: agent.specialties || [],
        years_experience: agent.yearsOfExperience || agent.experience || null,
        license_number: agent.licenseNumber || null,
        description: agent.description || agent.bio || agent.about || null,
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
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div className="space-y-0.5">
            <Label htmlFor="test-mode" className="text-base font-semibold">Test Mode</Label>
            <p className="text-sm text-muted-foreground">
              Use sample Gilbert agent data instead of calling the API
            </p>
          </div>
          <Switch
            id="test-mode"
            checked={testMode}
            onCheckedChange={setTestMode}
          />
        </div>
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
                    <div className="flex gap-4">
                      {/* Agent Photo */}
                      {agent.profilePhotoSrc && (
                        <div className="flex-shrink-0">
                          <img 
                            src={agent.profilePhotoSrc} 
                            alt={agent.fullName}
                            className="w-20 h-20 rounded-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg';
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Agent Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-lg">
                              {agent.fullName}
                            </p>
                            {agent.profileLink && (
                              <a 
                                href={agent.profileLink.startsWith('http') ? agent.profileLink : `https://www.zillow.com${agent.profileLink}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                View Zillow Profile →
                              </a>
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
                        
                        <p className="text-sm font-medium text-muted-foreground">
                          {agent.businessName}
                        </p>
                        
                        {/* Contact Info */}
                        <div className="space-y-1">
                          {agent.phoneNumber && (
                            <p className="text-sm">
                              📱 Phone: {agent.phoneNumber}
                            </p>
                          )}
                          {agent.location && (
                            <p className="text-sm text-muted-foreground">
                              📍 {agent.location}
                            </p>
                          )}
                        </div>
                        
                        {/* Ratings */}
                        {agent.numTotalReviews > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">⭐ {agent.reviewStarsRating}</span>
                            <span className="text-muted-foreground">
                              ({agent.numTotalReviews} reviews)
                            </span>
                          </div>
                        )}
                        
                        {/* Review Excerpt */}
                        {agent.reviewExcerpt && (
                          <p className="text-sm text-muted-foreground italic">
                            "{agent.reviewExcerpt}"
                          </p>
                        )}
                      </div>
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
