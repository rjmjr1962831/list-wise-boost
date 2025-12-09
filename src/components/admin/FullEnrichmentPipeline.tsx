import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Loader2, Zap, CheckCircle2, AlertCircle, User, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface City {
  id: string;
  name: string;
  state: string;
}

interface ShortBioAgent {
  id: string;
  name: string;
  synthesized_bio: string;
  word_count: number;
}

export default function FullEnrichmentPipeline() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [fullEnrichment, setFullEnrichment] = useState(true);
  const [targetAgents, setTargetAgents] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [queueStats, setQueueStats] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0
  });
  
  // Cost control options (defaults to enabled)
  const [dryRun, setDryRun] = useState(false);
  const [skipRecentlyEnriched, setSkipRecentlyEnriched] = useState(true);
  const [skipGenericBios, setSkipGenericBios] = useState(true);
  const [skipIfNoPress, setSkipIfNoPress] = useState(true);
  
  // Single agent enrichment
  const [singleAgentSearch, setSingleAgentSearch] = useState("");
  const [singleAgentLoading, setSingleAgentLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Short bio resynthesis
  const [shortBioAgents, setShortBioAgents] = useState<ShortBioAgent[]>([]);
  const [shortBioLoading, setShortBioLoading] = useState(false);
  const [shortBioProgress, setShortBioProgress] = useState({ current: 0, total: 0 });
  const [minWordCount, setMinWordCount] = useState(200);
  const [batchSize, setBatchSize] = useState(10);
  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    let channel: any;

    if (isRunning && !dryRun) {
      loadQueueStats();
      
      channel = supabase
        .channel('queue-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contact_enrichment_queue'
          },
          () => {
            loadQueueStats();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isRunning, dryRun]);

  const fetchCities = async () => {
    const { data, error } = await supabase
      .from("cities")
      .select("id, name, state")
      .eq("active", true)
      .eq("state", "Arizona")
      .order("name");

    if (error) {
      console.error("Error fetching cities:", error);
      toast.error("Failed to load cities");
    } else {
      setCities(data || []);
    }
  };

  const loadQueueStats = async () => {
    const { data, error } = await supabase
      .from('contact_enrichment_queue')
      .select('status')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) {
      const stats = {
        pending: data.filter(i => i.status === 'pending').length,
        processing: data.filter(i => i.status === 'processing').length,
        completed: data.filter(i => i.status === 'completed').length,
        failed: data.filter(i => i.status === 'failed').length,
        total: 0
      };
      stats.total = stats.pending + stats.processing + stats.completed + stats.failed;
      setQueueStats(stats);
    }
  };

  const addLog = (message: string) => {
    setStatusLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const estimateCredits = () => {
    const baseCreditsPerAgent = 2; // 1 for bio + 1 for synthesis
    let creditsPerAgent = baseCreditsPerAgent;

    if (skipGenericBios) creditsPerAgent -= 0.5;
    if (skipIfNoPress) creditsPerAgent -= 0.5;
    if (skipRecentlyEnriched) creditsPerAgent *= 0.5;

    return {
      perAgent: Math.max(0.1, creditsPerAgent).toFixed(1),
      total: (Math.max(0.1, creditsPerAgent) * targetAgents).toFixed(0),
      savings: ((1 - creditsPerAgent / baseCreditsPerAgent) * 100).toFixed(0)
    };
  };

  const searchAgent = async () => {
    if (!singleAgentSearch.trim()) {
      toast.error("Please enter a name, email, or ID to search");
      return;
    }

    setSingleAgentLoading(true);
    setSearchResults([]);
    setSelectedAgent(null);
    setSearchPerformed(false);

    try {
      const searchTerm = singleAgentSearch.trim();
      
      // Check if it's a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
      
      let data, error;
      
      if (isUUID) {
        const result = await supabase
          .from('professionals')
          .select('id, name, email, phone, website, image_url, review_stars_rating, num_total_reviews, zillow_profile_url, zillow_data_fetched_at, synthesized_bio')
          .eq('active', true)
          .eq('id', searchTerm)
          .limit(10);
        data = result.data;
        error = result.error;
      } else {
        // Search by name first
        const nameResult = await supabase
          .from('professionals')
          .select('id, name, email, phone, website, image_url, review_stars_rating, num_total_reviews, zillow_profile_url, zillow_data_fetched_at, synthesized_bio')
          .eq('active', true)
          .ilike('name', `%${searchTerm}%`)
          .limit(10);
        
        if (nameResult.error) throw nameResult.error;
        
        // If no results by name, try email
        if (!nameResult.data || nameResult.data.length === 0) {
          const emailResult = await supabase
            .from('professionals')
            .select('id, name, email, phone, website, image_url, review_stars_rating, num_total_reviews, zillow_profile_url, zillow_data_fetched_at, synthesized_bio')
            .eq('active', true)
            .ilike('email', `%${searchTerm}%`)
            .limit(10);
          data = emailResult.data;
          error = emailResult.error;
        } else {
          data = nameResult.data;
          error = null;
        }
      }

      if (error) throw error;

      setSearchPerformed(true);
      
      if (!data || data.length === 0) {
        toast.info("No agents found matching your search");
      } else {
        setSearchResults(data);
        toast.success(`Found ${data.length} agent(s)`);
        if (data.length === 1) {
          setSelectedAgent(data[0]);
        }
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Search failed: " + error.message);
    } finally {
      setSingleAgentLoading(false);
    }
  };

  const enrichSingleAgent = async () => {
    if (!selectedAgent) {
      toast.error("Please select an agent first");
      return;
    }

    setSingleAgentLoading(true);
    addLog(`🎯 Starting single agent enrichment for: ${selectedAgent.name}`);

    try {
      // Step 1: Fetch memo23 data
      addLog(`📡 Fetching memo23 data...`);
      const { data: memo23Data, error: memo23Error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
        body: {
          professionalId: selectedAgent.id,
          dryRun: false,
          skipRecentlyEnriched: false,
          skipGenericBios: false
        }
      });

      if (memo23Error) {
        addLog(`❌ Memo23 fetch failed: ${memo23Error.message}`);
      } else if (memo23Data?.skipped) {
        addLog(`⏭️ Memo23: ${memo23Data.reason}`);
      } else {
        addLog(`✅ Memo23 data fetched successfully`);
      }

      // Step 2: Run profile synthesis
      addLog(`🧠 Running profile synthesis...`);
      const { data: synthData, error: synthError } = await supabase.functions.invoke('synthesize-agent-profile', {
        body: {
          professionalId: selectedAgent.id
        }
      });

      if (synthError) {
        addLog(`❌ Synthesis failed: ${synthError.message}`);
      } else {
        addLog(`✅ Profile synthesis complete`);
        if (synthData?.synthesizedBio) {
          addLog(`📝 Generated ${synthData.synthesizedBio.length} char bio`);
        }
      }

      addLog(`🎉 Single agent enrichment complete for ${selectedAgent.name}!`);
      toast.success(`Enrichment complete for ${selectedAgent.name}`);

      // Refresh the agent data
      const { data: refreshed } = await supabase
        .from('professionals')
        .select('id, name, email, phone, website, image_url, review_stars_rating, num_total_reviews, zillow_profile_url, zillow_data_fetched_at, synthesized_bio')
        .eq('id', selectedAgent.id)
        .single();

      if (refreshed) {
        setSelectedAgent(refreshed);
      }
    } catch (error: any) {
      console.error("Single agent enrichment error:", error);
      addLog(`❌ Error: ${error.message}`);
      toast.error("Enrichment failed: " + error.message);
    } finally {
      setSingleAgentLoading(false);
    }
  };

  // Short bio resynthesis functions
  const findShortBios = async () => {
    setShortBioLoading(true);
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, synthesized_bio')
        .eq('active', true)
        .not('synthesized_bio', 'is', null)
        .order('name');

      if (error) throw error;

      // Filter by word count on client side
      const filtered = (data || [])
        .filter(agent => agent.synthesized_bio && agent.synthesized_bio.trim().length > 0)
        .map(agent => ({
          ...agent,
          word_count: agent.synthesized_bio.split(/\s+/).length
        }))
        .filter(agent => agent.word_count < minWordCount)
        .sort((a, b) => a.word_count - b.word_count);

      setShortBioAgents(filtered);
      toast.success(`Found ${filtered.length} agents with bios under ${minWordCount} words`);
    } catch (error: any) {
      console.error("Error finding short bios:", error);
      toast.error("Failed to find short bios: " + error.message);
    } finally {
      setShortBioLoading(false);
    }
  };

  const resynthesizeShortBios = async () => {
    if (shortBioAgents.length === 0) {
      toast.error("No agents to resynthesize. Click 'Find Short Bios' first.");
      return;
    }

    setShortBioLoading(true);
    const total = Math.min(batchSize, shortBioAgents.length);
    setShortBioProgress({ current: 0, total });
    
    let successCount = 0;
    let failCount = 0;

    addLog(`🔄 Starting resynthesis of ${total} agents with short bios...`);

    for (let i = 0; i < total; i++) {
      const agent = shortBioAgents[i];
      setShortBioProgress({ current: i + 1, total });
      addLog(`📝 [${i + 1}/${total}] Resynthesizing: ${agent.name} (${agent.word_count} words)`);

      try {
        const { data, error } = await supabase.functions.invoke('synthesize-agent-profile', {
          body: { professionalId: agent.id }
        });

        if (error) {
          addLog(`❌ Failed: ${agent.name} - ${error.message}`);
          failCount++;
        } else {
          const newWordCount = data?.synthesizedBio?.split(/\s+/).length || 0;
          addLog(`✅ Done: ${agent.name} - now ${newWordCount} words`);
          successCount++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        addLog(`❌ Error: ${agent.name} - ${error.message}`);
        failCount++;
      }
    }

    addLog(`🎉 Resynthesis complete: ${successCount} success, ${failCount} failed`);
    toast.success(`Resynthesis complete: ${successCount} success, ${failCount} failed`);
    
    // Refresh the list
    await findShortBios();
    setShortBioLoading(false);
  };

  const runEnrichment = async () => {
    if (!selectedCityId) {
      toast.error("Please select a city");
      return;
    }

    setIsRunning(true);
    setStatusLog([]);
    setProgress(0);

    try {
      // Get category ID
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", "top10realestateagents")
        .single();

      if (!category) {
        throw new Error("Real Estate Agent category not found");
      }

      const city = cities.find(c => c.id === selectedCityId);
      const credits = estimateCredits();
      
      addLog(`🚀 Starting ${fullEnrichment ? 'FULL' : 'standard'} enrichment for ${city?.name}, ${city?.state}`);
      addLog(`🎯 Target: ${targetAgents} qualified agents`);
      addLog(`💰 Estimated cost: ${credits.total} credits (${credits.perAgent} per agent, ${credits.savings}% savings)`);
      if (dryRun) addLog(`⚠️ DRY RUN MODE - No AI calls will be made`);
      
      setCurrentPhase("Phase 1: Import");
      setProgress(10);

      // Call import-city-agents with cost controls
      const { data, error } = await supabase.functions.invoke("import-city-agents", {
        body: {
          cityId: selectedCityId,
          categoryId: category.id,
          maxResults: 100,
          forceRefresh: true,
          fullEnrichment: fullEnrichment,
          maxQualifiedAgents: targetAgents,
          dryRun,
          skipRecentlyEnriched,
          skipGenericBios,
          skipIfNoPress
        }
      });

      if (error) {
        throw error;
      }

      // Handle different response types
      if (data.dryRun) {
        addLog(`✅ DRY RUN complete - No actual imports made`);
        addLog(`📊 Estimated results:`);
        addLog(`   • Would import: ~${data.wouldImport} agents`);
        addLog(`   • Would queue: ~${data.wouldQueue} for enrichment`);
        addLog(`   • Credits per agent: ${data.creditsPerAgent} (${data.savingsPercent}% savings)`);
        addLog(`   • Total credits: ~${data.totalCredits}`);
        addLog(``);
        addLog(`💡 Remove "Dry Run" toggle to execute actual import`);
        
        setProgress(100);
        setCurrentPhase("Dry Run Complete");
        
        toast.success(`Dry run complete! Would import ~${data.wouldImport} agents using ~${data.totalCredits} credits`);
      } else if (data.alreadyMet) {
        // Target already reached - no import needed
        addLog(`✅ ${city?.name} already has ${data.count} qualified agents linked`);
        addLog(`🎯 Target was ${targetAgents} agents - already met!`);
        addLog(`📦 Checking for agents that still need enrichment...`);
        
        setProgress(100);
        setCurrentPhase("Already Complete");
        
        toast.info(`${city?.name} already has ${data.count} qualified agents - no import needed`);
      } else if (data.cached) {
        // Using cached data
        addLog(`✅ Using ${data.count} cached agents from database`);
        addLog(`📅 Last updated: ${data.message?.match(/\d+ days ago/)?.[0] || 'recently'}`);
        addLog(`💾 Fresh data available - no import needed`);
        
        setProgress(100);
        setCurrentPhase("Using Cached Data");
        
        toast.success(`Using ${data.count} cached agents - data is fresh`);
      } else {
        // Normal execution path
        addLog(`✅ Import phase complete: ${data.imported || 0} agents imported`);
        addLog(`📋 Queued ${data.queued || 0} agents for enrichment`);
        setProgress(30);
        
        setCurrentPhase("Phase 2: Enriching");
        addLog(`📋 Enriching agent profiles with memo23...`);
        addLog(`⚙️ Smart deduplication active - reusing existing enriched data`);
        
        // Poll for enrichment progress
        await pollEnrichmentProgress(selectedCityId, category.id);
        
        if (fullEnrichment) {
          setCurrentPhase("Phase 3: Press & Synthesis");
          addLog(`📰 Running press research & profile synthesis...`);
          setProgress(70);
          
          // Wait for synthesis to complete
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          addLog(`✅ Press research & synthesis complete`);
        }
        
        setProgress(100);
        setCurrentPhase("Complete");
        addLog(`🎉 Enrichment complete for ${city?.name}!`);
        
        toast.success(`Full enrichment complete for ${city?.name}!`);
      }
    } catch (error: any) {
      console.error("Enrichment error:", error);
      addLog(`❌ Error: ${error.message}`);
      toast.error(error.message || "Enrichment failed");
    } finally {
      setIsRunning(false);
    }
  };

  const retryStuckItems = async () => {
    try {
      addLog(`🔄 Resetting stuck items and restarting queue...`);
      
      // Reset stuck items
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: resetItems } = await supabase
        .from('contact_enrichment_queue')
        .update({ 
          status: 'pending', 
          stage: 'queued',
          started_at: null 
        })
        .eq('status', 'processing')
        .lt('started_at', fiveMinutesAgo)
        .select('id');

      if (resetItems && resetItems.length > 0) {
        addLog(`✅ Reset ${resetItems.length} stuck items`);
        toast.success(`Reset ${resetItems.length} stuck items`);
      } else {
        addLog(`ℹ️ No stuck items found`);
        toast.info("No stuck items found");
      }

      // Trigger queue processor
      await supabase.functions.invoke('process-contact-enrichment-queue', {
        body: {
          batchSize: targetAgents,
          concurrency: 10,
          dryRun,
          skipRecentlyEnriched,
          skipGenericBios,
          skipIfNoPress
        }
      });

      addLog(`🚀 Queue processor triggered`);
      loadQueueStats(); // Refresh stats
    } catch (error: any) {
      console.error("Error resetting stuck items:", error);
      addLog(`❌ Error: ${error.message}`);
      toast.error("Failed to reset stuck items");
    }
  };

  const enrichPhoenixMetro = async () => {
    const phoenixMetroCities = [
      'Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 
      'Glendale', 'Peoria', 'Surprise', 'Avondale', 'Goodyear', 'Buckeye',
      'Queen Creek', 'Fountain Hills', 'Paradise Valley', 'Cave Creek'
    ];

    const metroCities = cities.filter(city => 
      phoenixMetroCities.some(metro => city.name.toLowerCase().includes(metro.toLowerCase()))
    );

    if (metroCities.length === 0) {
      toast.error("No Phoenix metro cities found");
      return;
    }

    if (!confirm(`This will queue enrichment for ${metroCities.length} Phoenix metro area cities. Continue?`)) {
      return;
    }

    await enrichCities(metroCities, 'Phoenix Metro');
  };

  const enrichAllCities = async () => {
    if (!confirm(`This will queue enrichment for ALL ${cities.length} Arizona cities. Continue?`)) {
      return;
    }

    await enrichCities(cities, 'All Arizona');
  };

  const enrichEmptyCitiesOnly = async () => {
    try {
      setIsRunning(true);
      addLog('🔍 Finding cities with 0 agents...');
      
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", "top10realestateagents")
        .single();

      if (!category) {
        throw new Error("Real Estate Agent category not found");
      }

      // Get count of agents per city
      const { data: agentCounts } = await supabase
        .from('professional_cities')
        .select('city_id, professionals!inner(id, category_id)')
        .eq('active', true)
        .eq('professionals.category_id', category.id);

      // Create a set of city IDs that have agents
      const citiesWithAgents = new Set(agentCounts?.map(ac => ac.city_id) || []);

      // Filter to cities with 0 agents
      const emptyCities = cities.filter(city => !citiesWithAgents.has(city.id));

      if (emptyCities.length === 0) {
        toast.info("All cities already have agents!");
        setIsRunning(false);
        return;
      }

      addLog(`📍 Found ${emptyCities.length} cities with 0 agents`);
      emptyCities.forEach(city => addLog(`   • ${city.name}`));

      if (!confirm(`This will populate ${emptyCities.length} cities with 0 agents. Continue?`)) {
        setIsRunning(false);
        return;
      }

      await enrichCities(emptyCities, 'Empty Cities');
    } catch (error: any) {
      console.error("Error finding empty cities:", error);
      addLog(`❌ Error: ${error.message}`);
      toast.error("Failed to find empty cities");
      setIsRunning(false);
    }
  };

  const crossLinkMetroAgents = async () => {
    try {
      setIsRunning(true);
      setStatusLog([]);
      addLog('🔗 Starting cross-link of metro agents to empty cities...');

      const { data, error } = await supabase.functions.invoke('cross-link-metro-agents');

      if (error) {
        throw error;
      }

      if (data.success) {
        addLog(`✅ Successfully linked ${data.total_linked} agents to ${data.cities_processed} cities`);
        data.results.forEach((result: any) => {
          addLog(`   • ${result.city}: ${result.linked} agents from ${result.metro}`);
        });
        toast.success(`Linked ${data.total_linked} agents to empty cities!`);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error("Error cross-linking metro agents:", error);
      addLog(`❌ Error: ${error.message}`);
      toast.error("Failed to cross-link metro agents");
    } finally {
      setIsRunning(false);
    }
  };

  const enrichCities = async (citiesToEnrich: City[], region: string) => {
    setIsRunning(true);
    setStatusLog([]);
    setProgress(0);

    try {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", "top10realestateagents")
        .single();

      if (!category) {
        throw new Error("Real Estate Agent category not found");
      }

      addLog(`🚀 Starting batch enrichment for ${region} (${citiesToEnrich.length} cities)`);
      addLog(`💰 Using cost controls: ${skipRecentlyEnriched ? 'skip recent' : ''} ${skipGenericBios ? 'skip generic' : ''} ${skipIfNoPress ? 'skip no press' : ''}`);
      if (dryRun) addLog(`⚠️ DRY RUN MODE - No AI calls will be made`);

      setCurrentPhase("Queuing Cities");
      setProgress(10);

      let totalQueued = 0;
      let citiesProcessed = 0;

      for (const city of citiesToEnrich) {
        addLog(`📍 Processing ${city.name}, ${city.state}...`);
        
        const { data, error } = await supabase.functions.invoke("import-city-agents", {
          body: {
            cityId: city.id,
            categoryId: category.id,
            maxResults: 100,
            forceRefresh: false,
            fullEnrichment: fullEnrichment,
            maxQualifiedAgents: 200,
            dryRun,
            skipRecentlyEnriched,
            skipGenericBios,
            skipIfNoPress
          }
        });

        if (error) {
          addLog(`❌ Error processing ${city.name}: ${error.message}`);
        } else if (data.queued) {
          totalQueued += data.queued;
          addLog(`✅ ${city.name}: queued ${data.queued} agents`);
        } else {
          addLog(`ℹ️ ${city.name}: ${data.message || 'no new agents to queue'}`);
        }

        citiesProcessed++;
        setProgress(10 + (citiesProcessed / cities.length) * 40);

        // Small delay between cities to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      addLog(`📊 Batch queue complete: ${totalQueued} agents queued across ${citiesProcessed} cities`);
      setProgress(60);

      if (totalQueued > 0 && !dryRun) {
        setCurrentPhase("Processing Queue");
        addLog(`🔄 Starting queue processor...`);
        
        // Trigger the queue processor
        await supabase.functions.invoke('process-contact-enrichment-queue', {
          body: {
            batchSize: 100,
            concurrency: 10,
            dryRun,
            skipRecentlyEnriched,
            skipGenericBios,
            skipIfNoPress
          }
        });

        addLog(`✅ Queue processor started`);
        setProgress(100);
        setCurrentPhase("Complete");
        toast.success(`Queued ${totalQueued} agents for enrichment`);
      } else {
        setProgress(100);
        setCurrentPhase("Complete");
        toast.info(dryRun ? "Dry run complete" : "No new agents to enrich");
      }

    } catch (error: any) {
      console.error("Batch enrichment error:", error);
      addLog(`❌ Error: ${error.message}`);
      toast.error(error.message || "Batch enrichment failed");
    } finally {
      setIsRunning(false);
    }
  };

  const pollEnrichmentProgress = async (cityId: string, categoryId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max

    while (attempts < maxAttempts) {
      const { data: agents } = await supabase
        .from("professionals")
        .select("id, name, zillow_data_fetched_at", { count: "exact" })
        .eq("city_id", cityId)
        .eq("category_id", categoryId)
        .eq("active", true);

      const enrichedCount = agents?.filter(a => a.zillow_data_fetched_at).length || 0;
      const totalCount = agents?.length || 0;

      if (enrichedCount > 0) {
        const progressPercent = 30 + Math.floor((enrichedCount / Math.max(totalCount, 1)) * 40);
        setProgress(progressPercent);
        addLog(`📊 Enrichment progress: ${enrichedCount}/${totalCount} agents`);
      }

      if (enrichedCount >= targetAgents || enrichedCount === totalCount) {
        addLog(`✅ Enrichment complete: ${enrichedCount} agents enriched`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10s
      attempts++;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-6 w-6" />
          Full Enrichment Pipeline
        </CardTitle>
        <CardDescription>
          Run complete agent enrichment: Import → Memo23 → Press Research → Profile Synthesis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            <strong>Smart Deduplication:</strong> Agents appearing in multiple cities are enriched once, then data is copied.
            <br />
            <strong>Full Enrichment:</strong> Includes press research via Claude and auto-synthesis of bios, achievements, and publications.
          </AlertDescription>
        </Alert>

        {/* Single Agent Enrichment Section */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <Label className="text-base font-semibold">Single Agent Enrichment</Label>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Search by name, email, or paste UUID..."
              value={singleAgentSearch}
              onChange={(e) => setSingleAgentSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchAgent()}
              disabled={singleAgentLoading}
              className="flex-1"
            />
            <Button onClick={searchAgent} disabled={singleAgentLoading} variant="secondary">
              {singleAgentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Search Results ({searchResults.length}):</Label>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {searchResults.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`p-2 rounded cursor-pointer border transition-colors ${
                      selectedAgent?.id === agent.id 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {agent.image_url && (
                        <img src={agent.image_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {agent.email || 'No email'} • {agent.review_stars_rating?.toFixed(1) || 'NA'}★ • {agent.num_total_reviews || 0} reviews
                        </p>
                      </div>
                      {agent.synthesized_bio && (
                        <span title="Has synthesized bio">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchPerformed && searchResults.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No agents found matching "<strong>{singleAgentSearch}</strong>". Try a different name or check spelling.
              </AlertDescription>
            </Alert>
          )}

          {selectedAgent && (
            <div className="p-3 rounded-lg border bg-background space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedAgent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Last enriched: {selectedAgent.zillow_data_fetched_at 
                      ? new Date(selectedAgent.zillow_data_fetched_at).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
              {selectedAgent.synthesized_bio && (
                <p 
                  className="text-xs text-muted-foreground line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: selectedAgent.synthesized_bio }}
                />
              )}
            </div>
          )}

          {/* Always visible Enrich button */}
          <Button 
            onClick={enrichSingleAgent} 
            disabled={singleAgentLoading || !selectedAgent}
            className="w-full"
            size="lg"
          >
            {singleAgentLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            {selectedAgent ? `Run Enrichment for ${selectedAgent.name}` : 'Select an agent to enrich'}
          </Button>
        </div>

        {/* Short Bio Resynthesis Section */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <Label className="text-base font-semibold">Short Bio Resynthesis</Label>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Find and resynthesize agents with bios under a certain word count to generate longer, more detailed profiles.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Minimum Word Count: {minWordCount}</Label>
              <Slider
                value={[minWordCount]}
                onValueChange={([value]) => setMinWordCount(value)}
                min={50}
                max={400}
                step={25}
                disabled={shortBioLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Batch Size: {batchSize}</Label>
              <Slider
                value={[batchSize]}
                onValueChange={([value]) => setBatchSize(value)}
                min={5}
                max={50}
                step={5}
                disabled={shortBioLoading}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={findShortBios} disabled={shortBioLoading} variant="secondary">
              {shortBioLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Find Short Bios
            </Button>
            <Button 
              onClick={resynthesizeShortBios} 
              disabled={shortBioLoading || shortBioAgents.length === 0}
            >
              {shortBioLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Resynthesize ({shortBioAgents.length > 0 ? Math.min(batchSize, shortBioAgents.length) : 0})
            </Button>
          </div>

          {shortBioProgress.total > 0 && shortBioLoading && (
            <div className="space-y-2">
              <Progress value={(shortBioProgress.current / shortBioProgress.total) * 100} />
              <p className="text-xs text-muted-foreground text-center">
                Processing {shortBioProgress.current} of {shortBioProgress.total}
              </p>
            </div>
          )}

          {shortBioAgents.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Found {shortBioAgents.length} agents with bios under {minWordCount} words:
              </Label>
              <div className="max-h-40 overflow-y-auto border rounded p-2 bg-background text-xs space-y-1">
                {shortBioAgents.slice(0, 50).map((agent) => (
                  <div key={agent.id} className="flex justify-between">
                    <span className="truncate">{agent.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">{agent.word_count} words</span>
                  </div>
                ))}
                {shortBioAgents.length > 50 && (
                  <p className="text-muted-foreground">...and {shortBioAgents.length - 50} more</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>City</Label>
            <Select value={selectedCityId} onValueChange={setSelectedCityId} disabled={isRunning}>
              <SelectTrigger>
                <SelectValue placeholder="Select a city" />
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
            <Label>Target Qualified Agents: {targetAgents}</Label>
            <Slider
              value={[targetAgents]}
              onValueChange={([value]) => setTargetAgents(value)}
              min={50}
              max={500}
              step={10}
              disabled={isRunning}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground">
              System will import until it reaches this many agents with 4.8★+ rating and 50+ reviews
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Cost Controls</Label>
            <div className="text-sm text-muted-foreground">
              Est: <span className="font-mono font-semibold">{estimateCredits().total}</span> credits 
              <span className="text-green-600 ml-2">({estimateCredits().savings}% savings)</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={isRunning}
              />
              <Label htmlFor="dry-run" className="cursor-pointer text-sm">
                Dry Run (zero cost, logs only)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="skip-recent"
                checked={skipRecentlyEnriched}
                onCheckedChange={setSkipRecentlyEnriched}
                disabled={isRunning}
              />
              <Label htmlFor="skip-recent" className="cursor-pointer text-sm">
                Skip Recently Enriched (saves ~70%)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="skip-generic"
                checked={skipGenericBios}
                onCheckedChange={setSkipGenericBios}
                disabled={isRunning}
              />
              <Label htmlFor="skip-generic" className="cursor-pointer text-sm">
                Skip Generic Bio Rewrites (saves ~25%)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="skip-no-press"
                checked={skipIfNoPress}
                onCheckedChange={setSkipIfNoPress}
                disabled={isRunning}
              />
              <Label htmlFor="skip-no-press" className="cursor-pointer text-sm">
                Skip Synthesis Without Press (saves ~25%)
              </Label>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="full-enrichment"
            checked={fullEnrichment}
            onCheckedChange={setFullEnrichment}
            disabled={isRunning}
          />
          <Label htmlFor="full-enrichment" className="cursor-pointer">
            Enable Full Enrichment (Press Research + Profile Synthesis)
          </Label>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={runEnrichment}
              disabled={isRunning || !selectedCityId}
              className="flex-1"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {currentPhase}...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Run {fullEnrichment ? "Full" : "Standard"} Enrichment
                </>
              )}
            </Button>
            
            <Button
              onClick={retryStuckItems}
              disabled={isRunning}
              variant="outline"
              size="lg"
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Retry Stuck
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={enrichPhoenixMetro}
              disabled={isRunning || cities.length === 0}
              variant="secondary"
              size="lg"
            >
              <Zap className="mr-2 h-4 w-4" />
              Phoenix Metro
            </Button>

            <Button
              onClick={enrichEmptyCitiesOnly}
              disabled={isRunning || cities.length === 0}
              variant="secondary"
              size="lg"
            >
              <Zap className="mr-2 h-4 w-4" />
              Empty Cities Only
            </Button>

            <Button
              onClick={crossLinkMetroAgents}
              disabled={isRunning}
              variant="outline"
              size="lg"
              className="col-span-3"
            >
              <Zap className="mr-2 h-4 w-4" />
              Cross-Link Metro Agents to Empty Cities
            </Button>

            <Button
              onClick={enrichAllCities}
              disabled={isRunning || cities.length === 0}
              variant="outline"
              size="lg"
            >
              <Zap className="mr-2 h-4 w-4" />
              All AZ Cities
            </Button>
          </div>
        </div>

        {isRunning && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{currentPhase}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>

            {!dryRun && queueStats.total > 0 && (
              <div className="grid grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                    {queueStats.pending}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Pending</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {queueStats.processing}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Processing</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {queueStats.completed}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Completed</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {queueStats.failed}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Failed</div>
                </div>
              </div>
            )}
          </div>
        )}

        {statusLog.length > 0 && (
          <div className="space-y-2">
            <Label>Status Log</Label>
            <div className="bg-muted rounded-md p-4 max-h-96 overflow-y-auto font-mono text-xs space-y-1">
              {statusLog.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap">
                  {log.includes("✅") ? (
                    <span className="text-green-600 dark:text-green-400">{log}</span>
                  ) : log.includes("❌") ? (
                    <span className="text-red-600 dark:text-red-400">{log}</span>
                  ) : log.includes("🎉") ? (
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">{log}</span>
                  ) : (
                    log
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
