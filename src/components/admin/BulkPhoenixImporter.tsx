import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Play, Loader2, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CityStatus {
  name: string;
  qualified_count: number;
}

interface ImportProgress {
  session_id: string;
  status: string;
  total_cities: number;
  current_index: number;
  current_city: string | null;
  results: {
    processed: { city: string; count: number }[];
    skipped: { city: string; reason: string }[];
    failed: { city: string; error: string }[];
  };
}

export function BulkPhoenixImporter() {
  const [isStarting, setIsStarting] = useState(false);
  const [cities, setCities] = useState<CityStatus[]>([]);
  const [citiesNeedingAgents, setCitiesNeedingAgents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<ImportProgress | null>(null);

  const fetchCityStats = async () => {
    setIsLoading(true);
    try {
      const { data: allCities, error } = await supabase
        .from('cities')
        .select('id, name')
        .eq('state', 'Arizona')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      const cityStats: CityStatus[] = [];
      const needsAgents: string[] = [];

      for (const city of allCities || []) {
        const { count } = await supabase
          .from('professionals')
          .select('id', { count: 'exact', head: true })
          .eq('city_id', city.id)
          .eq('active', true)
          .gte('review_stars_rating', 4.8)
          .gte('num_total_reviews', 50);

        cityStats.push({ name: city.name, qualified_count: count || 0 });
        if ((count || 0) < 10) {
          needsAgents.push(city.name);
        }
      }

      setCities(cityStats);
      setCitiesNeedingAgents(needsAgents);
    } catch (error) {
      console.error('Error fetching city stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveSession = useCallback(async () => {
    const { data } = await supabase
      .from('bulk_capture_progress')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setActiveSession(data as unknown as ImportProgress);
    } else {
      setActiveSession(null);
    }
  }, []);

  useEffect(() => {
    fetchCityStats();
    fetchActiveSession();
  }, [fetchActiveSession]);

  // Poll for progress when session is active
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      fetchActiveSession();
    }, 3000);

    return () => clearInterval(interval);
  }, [activeSession, fetchActiveSession]);

  const handleStartImport = async () => {
    setIsStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-import-phoenix-agents');
      
      if (error) throw error;
      
      toast.success(`Import started for ${data.totalCitiesNeedingAgents} cities (4.8★ + 20 reviews)`);
      
      // Start polling for the new session
      setTimeout(fetchActiveSession, 2000);
      
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to start bulk import');
    } finally {
      setIsStarting(false);
    }
  };

  const citiesWithEnough = cities.filter(c => c.qualified_count >= 10).length;
  const progressPercent = cities.length > 0 ? (citiesWithEnough / cities.length) * 100 : 0;
  const sessionProgress = activeSession ? (activeSession.current_index / activeSession.total_cities) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Bulk Arizona Agent Import
          <Button variant="ghost" size="sm" onClick={() => { fetchCityStats(); fetchActiveSession(); }} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Import agents (4.8★ + 20+ reviews) for Arizona cities with fewer than 10 qualified agents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Session Progress */}
        {activeSession && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Import in Progress
              </span>
              <span className="text-sm font-mono">
                {activeSession.current_index}/{activeSession.total_cities}
              </span>
            </div>
            <Progress value={sessionProgress} className="h-2" />
            {activeSession.current_city && (
              <p className="text-sm text-muted-foreground">
                Currently processing: <span className="font-medium">{activeSession.current_city}</span>
              </p>
            )}
            <div className="flex gap-4 text-xs">
              <span className="text-green-600">
                <CheckCircle className="inline h-3 w-3 mr-1" />
                {activeSession.results?.processed?.length || 0} imported
              </span>
              <span className="text-amber-600">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                {activeSession.results?.skipped?.length || 0} skipped
              </span>
              <span className="text-red-600">
                <XCircle className="inline h-3 w-3 mr-1" />
                {activeSession.results?.failed?.length || 0} failed
              </span>
            </div>
          </div>
        )}

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Cities with 10+ qualified agents</span>
            <span className="font-medium">{citiesWithEnough} / {cities.length}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Cities needing agents */}
        {citiesNeedingAgents.length > 0 && !activeSession && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
              {citiesNeedingAgents.length} cities need agents:
            </p>
            <div className="flex flex-wrap gap-1">
              {citiesNeedingAgents.map(city => (
                <span key={city} className="text-xs bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                  {city}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* City Status Grid */}
        <div className="max-h-64 overflow-y-auto border rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 p-2 text-xs">
            {cities.map(city => (
              <div 
                key={city.name} 
                className={`flex items-center justify-between p-1.5 rounded ${
                  city.qualified_count >= 10 
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                    : 'bg-red-500/10 text-red-700 dark:text-red-400'
                }`}
              >
                <span className="truncate">{city.name}</span>
                <span className="font-mono ml-1">{city.qualified_count}</span>
              </div>
            ))}
          </div>
        </div>

        <Button 
          onClick={handleStartImport} 
          disabled={isStarting || !!activeSession || citiesNeedingAgents.length === 0}
          className="w-full"
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : activeSession ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Import Running...
            </>
          ) : citiesNeedingAgents.length === 0 ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              All Cities Have 10+ Agents
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Import Agents for {citiesNeedingAgents.length} Cities
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
