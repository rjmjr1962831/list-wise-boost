import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Zap, Clock, CheckCircle2, XCircle, ArrowRight, User, Award, Newspaper, FileText, RefreshCw, Sparkles } from 'lucide-react';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import type { Professional } from '@/types/professional';

interface ScraperResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  method: string;
}

interface ProfessionalOption {
  id: string;
  name: string;
  zillow_profile_url: string | null;
  city_name?: string;
}

export const ScraperComparison = () => {
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<'firecrawl' | 'memo23' | 'both' | null>(null);
  const [loadingProfessionals, setLoadingProfessionals] = useState(true);
  
  const [firecrawlResult, setFirecrawlResult] = useState<ScraperResult | null>(null);
  const [memo23Result, setMemo23Result] = useState<ScraperResult | null>(null);
  
  const [firecrawlProfessional, setFirecrawlProfessional] = useState<Professional | null>(null);
  const [memo23Professional, setMemo23Professional] = useState<Professional | null>(null);
  const [currentDbProfessional, setCurrentDbProfessional] = useState<Professional | null>(null);

  // Fetch professionals list on mount
  useEffect(() => {
    const fetchProfessionals = async () => {
      setLoadingProfessionals(true);
      const { data, error } = await supabase
        .from('professionals')
        .select(`
          id, 
          name, 
          zillow_profile_url,
          cities!inner(name)
        `)
        .eq('active', true)
        .not('zillow_profile_url', 'is', null)
        .order('name')
        .limit(500);

      if (error) {
        console.error('Error fetching professionals:', error);
        toast.error('Failed to load professionals');
      } else {
        setProfessionals(
          (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            zillow_profile_url: p.zillow_profile_url,
            city_name: p.cities?.name || 'Unknown'
          }))
        );
      }
      setLoadingProfessionals(false);
    };
    fetchProfessionals();
  }, []);

  // Filter professionals by search query
  const filteredProfessionals = useMemo(() => {
    if (!searchQuery.trim()) return professionals.slice(0, 50);
    const query = searchQuery.toLowerCase();
    return professionals.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.city_name?.toLowerCase().includes(query)
    ).slice(0, 50);
  }, [professionals, searchQuery]);

  const selectedProfessional = professionals.find(p => p.id === selectedProfessionalId);

  // Fetch current DB professional data when selected
  useEffect(() => {
    if (!selectedProfessionalId) {
      setCurrentDbProfessional(null);
      return;
    }

    const fetchCurrentData = async () => {
      const { data, error } = await supabase
        .from('professionals')
        .select('*, cities(*), categories(*)')
        .eq('id', selectedProfessionalId)
        .single();

      if (!error && data) {
        setCurrentDbProfessional(data as unknown as Professional);
      }
    };
    fetchCurrentData();
  }, [selectedProfessionalId]);

  const mapFirecrawlToProfessional = (data: any, base: any): Professional => {
    return {
      ...(base || {}),
      id: base?.id || 'firecrawl-preview',
      name: data.name || base?.name || 'Unknown',
      // Firecrawl bio is the Zillow bio (get_to_know_me), NOT our synthesis
      get_to_know_me: data.bio || '',
      description: data.bio || '', // fallback for card display
      synthesized_bio: '', // Firecrawl doesn't generate synthesis
      rating: data.ratingsAverage || 0,
      reviews: data.ratingsCount || 0,
      total_sales: data.totalSales || 0,
      years_experience: data.yearsExperience || 0,
      image: data.imageUrl || data.profilePhotoUrl || base?.image_url || '',
      company: data.businessName || base?.company || '',
      specialties: data.specialties || [],
      notable_achievements: data.achievements || [],
      press_mentions: data.pressMentions || [],
      website: data.website || base?.website || '',
      phone: data.phone || base?.phone || '',
      email: data.email || base?.email || '',
      address: base?.address || '',
      rank: base?.rank || 1,
      verified: true,
      stats: {
        totalSales: data.totalSales,
        yearsExperience: data.yearsExperience,
      },
    } as Professional;
  };

  const mapMemo23ToProfessional = (data: any, base: any): Professional => {
    const ratings = data.ratings || {};
    const salesStats = data.agentSalesStats || data.agent_sales_stats || {};
    
    return {
      ...(base || {}),
      id: base?.id || 'memo23-preview',
      name: data.fullName || data.name || base?.name || 'Unknown',
      description: data.getToKnowMe || data.get_to_know_me || data.description || '',
      synthesized_bio: data.synthesized_bio || data.getToKnowMe || data.get_to_know_me || '',
      rating: ratings.average || data.reviewStarsRating || data.review_stars_rating || 0,
      reviews: ratings.count || data.numTotalReviews || data.num_total_reviews || 0,
      total_sales: salesStats.countAllTime || data.total_sales || 0,
      years_experience: data.yearsExperience || data.years_experience || 0,
      image: data.profilePhotoSrc || data.image_url || base?.image_url || '',
      company: data.businessName || data.business_name || data.company || base?.company || '',
      specialties: data.specialties || data.specialty || [],
      notable_achievements: data.notableAchievements || data.notable_achievements || [],
      press_mentions: data.pressMentions || data.press_mentions || [],
      website: data.website || base?.website || '',
      phone: data.phone || base?.phone || '',
      email: data.email || base?.email || '',
      address: base?.address || '',
      rank: base?.rank || 1,
      verified: true,
      stats: {
        totalSales: salesStats.countAllTime || data.total_sales,
        yearsExperience: data.years_experience,
      },
      // Memo23 specific fields as extended props
      get_to_know_me: data.getToKnowMe || data.get_to_know_me || '',
    } as Professional;
  };

  const testFirecrawl = async () => {
    if (!selectedProfessional?.zillow_profile_url) {
      toast.error('No Zillow URL found for this professional');
      return;
    }

    setLoading('firecrawl');
    setFirecrawlResult(null);
    setFirecrawlProfessional(null);
    const startTime = Date.now();
    
    try {
      // Step 1: Scrape Zillow with Firecrawl
      toast.info('Step 1/3: Scraping Zillow with Firecrawl...');
      const { data: firecrawlData, error: firecrawlError } = await supabase.functions.invoke('fetch-zillow-agent-firecrawl', {
        body: { profileUrl: selectedProfessional.zillow_profile_url }
      });

      if (firecrawlError) throw firecrawlError;
      if (!firecrawlData.success) throw new Error(firecrawlData.error || 'Firecrawl scrape failed');

      const scrapeTime = Date.now() - startTime;
      toast.success(`Zillow scraped in ${(scrapeTime / 1000).toFixed(1)}s`);

      // Step 2: Search for press mentions using Gemini
      toast.info('Step 2/3: Searching for press mentions...');
      const pressStartTime = Date.now();
      const { data: pressData, error: pressError } = await supabase.functions.invoke('search-agent-press-gemini', {
        body: {
          agentName: firecrawlData.data?.name || selectedProfessional.name,
          brokerage: firecrawlData.data?.businessName || currentDbProfessional?.company,
          city: (currentDbProfessional as any)?.cities?.name,
          state: 'Arizona',
          dryRun: true // Don't save to DB, just return results
        }
      });

      const pressMentions = pressData?.pressMentions || [];
      const pressTime = Date.now() - pressStartTime;
      toast.success(`Found ${pressMentions.length} press mentions in ${(pressTime / 1000).toFixed(1)}s`);

      // Step 3: Scrape agent website (Phase 4)
      let websiteContent = '';
      const agentWebsite = firecrawlData.data?.website || currentDbProfessional?.website;
      if (agentWebsite) {
        toast.info('Step 3/4: Scraping agent website...');
        const websiteStartTime = Date.now();
        try {
          const { data: websiteData } = await supabase.functions.invoke('fetch-zillow-agent-firecrawl', {
            body: {
              profileUrl: agentWebsite,
              scrapeWebsite: true // Flag to use onlyMainContent mode
            }
          });
          websiteContent = websiteData?.markdown || '';
          const websiteTime = Date.now() - websiteStartTime;
          toast.success(`Website scraped in ${(websiteTime / 1000).toFixed(1)}s`);
        } catch (e) {
          console.log('Website scrape failed, continuing without:', e);
        }
      }

      // Step 4: Synthesize bio using AI router
      toast.info(`Step ${agentWebsite ? '4/4' : '3/3'}: Synthesizing agent bio...`);
      const synthesisStartTime = Date.now();
      
      // Clean bio - extract only the actual biographical content
      // Remove: "Show more", "Specialties" section, "X Years of experience", markdown links, phone numbers
      const cleanBioExcerpt = (firecrawlData.data?.bio || '')
        .split(/\n\s*Specialties\b/i)[0] // Cut off at "Specialties" section
        .split(/\n\s*Show more\b/i)[0] // Cut off at "Show more"
        .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
        .replace(/\d+\s*Years?\s+of\s+experience/gi, '') // Remove years of experience line
        .replace(/Call me @?\s*[\d-().\s]+/gi, '') // Remove phone CTAs
        .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
        .replace(/\b(facebook|instagram|twitter|linkedin|youtube)\b[^\n]*/gi, '') // Remove social mentions
        .replace(/team\s+website[^\n]*/gi, '') // Remove team website lines
        .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
        .trim()
        .substring(0, 500);

      const bioPrompt = `Write a 3-5 sentence professional bio for ${firecrawlData.data?.name || selectedProfessional.name}, a real estate agent in Arizona.

FACTS TO INCLUDE:
- ${firecrawlData.data?.ratingsAverage || 'N/A'} star rating with ${firecrawlData.data?.ratingsCount || 0} reviews
- ${firecrawlData.data?.totalSales || 'Unknown'} total sales
- ${firecrawlData.data?.yearsExperience || 'Many'} years of experience
- Works at ${firecrawlData.data?.businessName || 'a local brokerage'}

BACKGROUND INFO (rework, don't quote):
${cleanBioExcerpt}

${websiteContent ? `FROM THEIR WEBSITE:\n${websiteContent.substring(0, 800)}` : ''}

${pressMentions.length > 0 ? `PRESS COVERAGE: ${pressMentions.slice(0, 3).map((p: any) => p.title).join('; ')}` : ''}

RULES:
- Write ONLY the bio text, nothing else
- Do NOT include URLs, website links, or social media
- Do NOT list specialties or bullet points
- Do NOT mention team members
- Write in third person, professional tone
- Focus on achievements and expertise`;

      const { data: synthesisData, error: synthesisError } = await supabase.functions.invoke('ai-router', {
        body: {
          task: 'bio-generation',
          messages: [
            { role: 'system', content: 'You are a professional bio writer. Output ONLY the bio text - no headers, no lists, no URLs, no formatting. Just 3-5 sentences of professional prose.' },
            { role: 'user', content: bioPrompt }
          ]
        }
      });

      // Clean any residual formatting from the response
      // ai-router returns OpenAI format: data.choices[0].message.content
      const rawBio = synthesisData?.choices?.[0]?.message?.content 
        || synthesisData?.content 
        || synthesisData?.text 
        || '';
      let synthesizedBio = rawBio
        .replace(/^#+\s*/gm, '') // Remove markdown headers
        .replace(/^\*+\s*/gm, '') // Remove bullet points
        .replace(/https?:\/\/[^\s]+/g, '') // Remove any URLs
        .trim();
      const synthesisTime = Date.now() - synthesisStartTime;
      toast.success(`Bio synthesized in ${(synthesisTime / 1000).toFixed(1)}s`);

      const totalDuration = Date.now() - startTime;

      // Combine all data
      const enrichedData = {
        ...firecrawlData.data,
        pressMentions,
        synthesizedBio,
        timings: {
          scrape: scrapeTime,
          press: pressTime,
          synthesis: synthesisTime,
          total: totalDuration
        }
      };

      setFirecrawlResult({
        success: true,
        data: enrichedData,
        duration: totalDuration,
        method: 'firecrawl'
      });

      // Map to Professional with enriched data
      const mapped = {
        ...mapFirecrawlToProfessional(firecrawlData.data, currentDbProfessional),
        press_mentions: pressMentions,
        synthesized_bio: synthesizedBio,
        notable_achievements: pressMentions.filter((p: any) => p.credibilityScore >= 7)
      };
      setFirecrawlProfessional(mapped as Professional);
      
      toast.success(`Full enrichment completed in ${(totalDuration / 1000).toFixed(1)}s`);

    } catch (error: any) {
      console.error('Firecrawl enrichment error:', error);
      setFirecrawlResult({
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        method: 'firecrawl'
      });
      toast.error(`Firecrawl error: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const testMemo23 = async () => {
    if (!selectedProfessionalId) {
      toast.error('Please select a professional first');
      return;
    }

    setLoading('memo23');
    setMemo23Result(null);
    setMemo23Professional(null);
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
        body: { 
          professionalId: selectedProfessionalId,
          dryRun: false,
          skipRecentlyEnriched: false // Force fresh fetch
        }
      });

      const duration = Date.now() - startTime;

      if (error) throw error;

      // After memo23 runs, fetch the updated professional data
      const { data: updatedProf } = await supabase
        .from('professionals')
        .select('*, cities(*), categories(*)')
        .eq('id', selectedProfessionalId)
        .single();

      setMemo23Result({
        success: data.success !== false,
        data: updatedProf || data,
        error: data.error,
        duration,
        method: 'memo23'
      });

      if (updatedProf) {
        setMemo23Professional(updatedProf as unknown as Professional);
        toast.success(`Memo23 completed in ${(duration / 1000).toFixed(2)}s`);
      } else {
        toast.warning('Memo23 completed but no data returned');
      }
    } catch (error: any) {
      setMemo23Result({
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        method: 'memo23'
      });
      toast.error(`Memo23 error: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const testBoth = async () => {
    if (!selectedProfessionalId || !selectedProfessional?.zillow_profile_url) {
      toast.error('Please select a professional with a Zillow URL');
      return;
    }

    setLoading('both');
    await Promise.all([testFirecrawl(), testMemo23()]);
    setLoading(null);
  };

  const renderDataComparison = (label: string, firecrawlVal: any, memo23Val: any, icon?: React.ReactNode) => {
    const fcDisplay = Array.isArray(firecrawlVal) ? firecrawlVal.length : (firecrawlVal || 'N/A');
    const m23Display = Array.isArray(memo23Val) ? memo23Val.length : (memo23Val || 'N/A');
    
    return (
      <div className="grid grid-cols-3 gap-2 py-2 border-b border-border/50 last:border-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </div>
        <div className="text-sm text-center">
          {typeof fcDisplay === 'number' ? fcDisplay.toLocaleString() : String(fcDisplay).slice(0, 50)}
        </div>
        <div className="text-sm text-center">
          {typeof m23Display === 'number' ? m23Display.toLocaleString() : String(m23Display).slice(0, 50)}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Scraper Comparison Tool
        </CardTitle>
        <CardDescription>
          Compare Firecrawl vs Memo23 side-by-side with rendered agent cards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Professional Selection */}
        <div className="space-y-3">
          <Label>Select a Professional to Compare</Label>
          <Input
            placeholder="Search by name or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-2"
          />
          <Select 
            value={selectedProfessionalId} 
            onValueChange={setSelectedProfessionalId}
            disabled={loadingProfessionals}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingProfessionals ? "Loading..." : "Select a professional..."} />
            </SelectTrigger>
            <SelectContent>
              {filteredProfessionals.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{p.name}</span>
                    <span className="text-muted-foreground text-xs">({p.city_name})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedProfessional && (
            <div className="text-sm text-muted-foreground">
              <strong>Zillow URL:</strong> {selectedProfessional.zillow_profile_url}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={testFirecrawl}
            disabled={!!loading || !selectedProfessionalId}
            variant="default"
          >
            {loading === 'firecrawl' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Test Firecrawl
          </Button>
          <Button
            onClick={testMemo23}
            disabled={!!loading || !selectedProfessionalId}
            variant="outline"
          >
            {loading === 'memo23' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Test Memo23
          </Button>
          <Button
            onClick={testBoth}
            disabled={!!loading || !selectedProfessionalId}
            variant="secondary"
          >
            {loading === 'both' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Test Both
          </Button>
        </div>

        {/* Results Tabs */}
        {(firecrawlResult || memo23Result) && (
          <Tabs defaultValue="cards" className="mt-6">
            <TabsList>
              <TabsTrigger value="cards">Card Comparison</TabsTrigger>
              <TabsTrigger value="synthesis">Synthesis & Bio</TabsTrigger>
              <TabsTrigger value="press">Press & Awards</TabsTrigger>
              <TabsTrigger value="raw">Raw Data</TabsTrigger>
            </TabsList>

            {/* Card Comparison Tab */}
            <TabsContent value="cards" className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center font-medium text-sm border-b pb-2">
                <div></div>
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="default">Firecrawl</Badge>
                  {firecrawlResult && (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {(firecrawlResult.duration / 1000).toFixed(2)}s
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="secondary">Memo23</Badge>
                  {memo23Result && (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {(memo23Result.duration / 1000).toFixed(2)}s
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Firecrawl Card */}
                <div className="space-y-2">
                  {firecrawlResult?.success && firecrawlProfessional ? (
                    <ProfessionalCard 
                      professional={firecrawlProfessional}
                      market={(currentDbProfessional as any)?.cities?.name || ''}
                      stateAbbr="AZ"
                    />
                  ) : firecrawlResult ? (
                    <Card className="border-destructive">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="h-5 w-5" />
                          <span>Firecrawl failed: {firecrawlResult.error}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="pt-6 text-center text-muted-foreground">
                        Click "Test Firecrawl" to fetch data
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Memo23 Card */}
                <div className="space-y-2">
                  {memo23Result?.success && memo23Professional ? (
                    <ProfessionalCard 
                      professional={memo23Professional}
                      market={(currentDbProfessional as any)?.cities?.name || ''}
                      stateAbbr="AZ"
                    />
                  ) : memo23Result ? (
                    <Card className="border-destructive">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="h-5 w-5" />
                          <span>Memo23 failed: {memo23Result.error}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="pt-6 text-center text-muted-foreground">
                        Click "Test Memo23" to fetch data
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Synthesis & Bio Tab */}
            <TabsContent value="synthesis" className="space-y-4">
              {/* Zillow Bio (From Agent) - What Zillow has */}
              <div>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">From {firecrawlProfessional?.name?.split(' ')[0] || memo23Professional?.name?.split(' ')[0] || 'Agent'} (Zillow Bio)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="default" className="mr-2">Firecrawl</Badge>
                        <FileText className="h-4 w-4" />
                        Zillow Bio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48">
                        <div className="whitespace-pre-line text-sm">
                          {firecrawlResult?.data?.bio || 'No Zillow bio data available'}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="secondary" className="mr-2">Memo23</Badge>
                        <FileText className="h-4 w-4" />
                        Zillow Bio (getToKnowMe)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48">
                        <div className="whitespace-pre-line text-sm">
                          {(memo23Professional as any)?.get_to_know_me || 'No Zillow bio data available'}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Our Synthesis - What we generate */}
              <div>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Our Synthesis (AI-generated)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="default" className="mr-2">Firecrawl</Badge>
                        <Sparkles className="h-4 w-4" />
                        Synthesized Bio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48">
                        <div className="whitespace-pre-line text-sm text-muted-foreground italic">
                          {firecrawlResult?.data?.synthesizedBio || 'Firecrawl does not generate synthesis (would need separate AI call)'}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="secondary" className="mr-2">Memo23</Badge>
                        <Sparkles className="h-4 w-4" />
                        Synthesized Bio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48">
                        <div className="whitespace-pre-line text-sm">
                          {memo23Professional?.synthesized_bio || 
                           memo23Professional?.description || 
                           'No synthesized bio available'}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Data Point Comparison */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Key Data Points Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 py-2 border-b font-medium text-sm">
                    <div>Field</div>
                    <div className="text-center">Firecrawl</div>
                    <div className="text-center">Memo23</div>
                  </div>
                  {renderDataComparison('Name', firecrawlResult?.data?.name, memo23Professional?.name, <User className="h-4 w-4" />)}
                  {renderDataComparison('Rating', firecrawlResult?.data?.ratingsAverage, memo23Professional?.rating)}
                  {renderDataComparison('Reviews', firecrawlResult?.data?.ratingsCount, memo23Professional?.reviews)}
                  {renderDataComparison('Total Sales', firecrawlResult?.data?.totalSales, memo23Professional?.total_sales)}
                  {renderDataComparison('Years Exp', firecrawlResult?.data?.yearsExperience, memo23Professional?.years_experience)}
                  {renderDataComparison('Company', firecrawlResult?.data?.businessName, memo23Professional?.company)}
                  {renderDataComparison('Zillow Bio Length', firecrawlResult?.data?.bio?.length || 0, 
                    (memo23Professional as any)?.get_to_know_me?.length || 0
                  )}
                  {renderDataComparison('Synthesis Length', 0, 
                    memo23Professional?.synthesized_bio?.length || memo23Professional?.description?.length || 0
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Press & Awards Tab */}
            <TabsContent value="press" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Firecrawl Press/Awards */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Newspaper className="h-4 w-4" />
                      Firecrawl Press Mentions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      {firecrawlResult?.data?.pressMentions?.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {firecrawlResult.data.pressMentions.map((mention: any, i: number) => (
                            <li key={i} className="border-b pb-2 last:border-0">
                              <div className="font-medium">{mention.title || mention.outlet || 'Press mention'}</div>
                              <div className="text-muted-foreground text-xs">{mention.url || mention.source}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted-foreground text-sm">No press mentions found</div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Memo23 Press/Awards */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Newspaper className="h-4 w-4" />
                      Memo23 Press Mentions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      {(memo23Professional?.press_mentions as any[])?.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {(memo23Professional?.press_mentions as any[]).map((mention: any, i: number) => (
                            <li key={i} className="border-b pb-2 last:border-0">
                              <div className="font-medium">{mention.title || mention.outlet || 'Press mention'}</div>
                              <div className="text-muted-foreground text-xs">{mention.url || mention.source}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted-foreground text-sm">No press mentions found</div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Awards Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Firecrawl Awards/Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      {firecrawlResult?.data?.achievements?.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {firecrawlResult.data.achievements.map((award: any, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <Award className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <span>{typeof award === 'string' ? award : award.title || award.name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted-foreground text-sm">No achievements found</div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Memo23 Awards/Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      {(memo23Professional?.notable_achievements as any[])?.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {(memo23Professional?.notable_achievements as any[]).map((award: any, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <Award className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <span>{typeof award === 'string' ? award : award.title || award.name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted-foreground text-sm">No achievements found</div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Raw Data Tab */}
            <TabsContent value="raw" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className={firecrawlResult?.success ? 'border-green-500' : 'border-destructive'}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {firecrawlResult?.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        Firecrawl Raw Data
                      </CardTitle>
                      {firecrawlResult && (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {(firecrawlResult.duration / 1000).toFixed(2)}s
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      {firecrawlResult?.data ? (
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(firecrawlResult.data, null, 2)}
                        </pre>
                      ) : firecrawlResult?.error ? (
                        <div className="text-destructive text-sm">{firecrawlResult.error}</div>
                      ) : (
                        <div className="text-muted-foreground text-sm">No data yet</div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className={memo23Result?.success ? 'border-green-500' : 'border-destructive'}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {memo23Result?.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        Memo23 Raw Data
                      </CardTitle>
                      {memo23Result && (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {(memo23Result.duration / 1000).toFixed(2)}s
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      {memo23Result?.data ? (
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(memo23Result.data, null, 2)}
                        </pre>
                      ) : memo23Result?.error ? (
                        <div className="text-destructive text-sm">{memo23Result.error}</div>
                      ) : (
                        <div className="text-muted-foreground text-sm">No data yet</div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};
