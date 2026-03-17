import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, Target, Award, Loader2, RefreshCw, MapPin } from "lucide-react";

interface ScanSummary {
  scan_date: string;
  state_slug: string;
  cities_scanned: number;
  cities_appearing: number;
  appearance_rate_pct: number;
  avg_position: number | null;
  best_position: number | null;
  citation_count: number;
}

interface CityResult {
  city_name: string;
  state_slug: string;
  top10lists_position: number | null;
  top10lists_url: string | null;
  cited_as_source: boolean;
  top_competitors: Array<{ position: number; url: string; title: string }> | null;
  scan_date: string;
}

interface TrendPoint {
  scan_date: string;
  appearance_rate: number;
  avg_position: number | null;
  citation_count: number;
  cities_scanned: number;
}

export default function GeoDashboard() {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [summaries, setSummaries] = useState<ScanSummary[]>([]);
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Get summaries (latest scan per state)
    const { data: summaryRaw } = await supabase.rpc("run_sql", {
      query: `
        SELECT scan_date::text, state_slug,
          COUNT(*)::int AS cities_scanned,
          COUNT(top10lists_position)::int AS cities_appearing,
          ROUND(100.0 * COUNT(top10lists_position) / NULLIF(COUNT(*), 0), 1)::float AS appearance_rate_pct,
          ROUND(AVG(top10lists_position) FILTER (WHERE top10lists_position IS NOT NULL), 1)::float AS avg_position,
          MIN(top10lists_position) FILTER (WHERE top10lists_position IS NOT NULL)::int AS best_position,
          COUNT(*) FILTER (WHERE cited_as_source = true)::int AS citation_count
        FROM geo_serp_results
        GROUP BY scan_date, state_slug
        ORDER BY scan_date DESC, state_slug
        LIMIT 20
      `,
    });
    const sums = (summaryRaw as ScanSummary[]) || [];
    setSummaries(sums);

    // Set default selected scan to latest
    if (sums.length > 0 && !selectedScan) {
      setSelectedScan(sums[0].scan_date);
    }

    // Get trends (aggregate per scan_date)
    const { data: trendRaw } = await supabase.rpc("run_sql", {
      query: `
        SELECT scan_date::text,
          ROUND(100.0 * COUNT(top10lists_position) / NULLIF(COUNT(*), 0), 1)::float AS appearance_rate,
          ROUND(AVG(top10lists_position) FILTER (WHERE top10lists_position IS NOT NULL), 1)::float AS avg_position,
          COUNT(*) FILTER (WHERE cited_as_source = true)::int AS citation_count,
          COUNT(*)::int AS cities_scanned
        FROM geo_serp_results
        GROUP BY scan_date
        ORDER BY scan_date DESC
        LIMIT 12
      `,
    });
    setTrends((trendRaw as TrendPoint[]) || []);

    // Get city-level results for latest scan
    const latestDate = sums[0]?.scan_date;
    if (latestDate) {
      await loadCityResults(latestDate);
    }

    setLoading(false);
  };

  const loadCityResults = async (scanDate: string) => {
    const { data: cityRaw } = await supabase.rpc("run_sql", {
      query: `
        SELECT city_name, state_slug, top10lists_position, top10lists_url,
          cited_as_source, top_competitors, scan_date::text
        FROM geo_serp_results
        WHERE scan_date = '${scanDate}'
        ORDER BY
          CASE WHEN top10lists_position IS NOT NULL THEN 0 ELSE 1 END,
          top10lists_position ASC NULLS LAST,
          city_name
      `,
    });
    setCityResults((cityRaw as CityResult[]) || []);
    setSelectedScan(scanDate);
  };

  const runScan = async (stateSlug?: string) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("geo-serper-scan", {
        body: stateSlug ? { state_slug: stateSlug } : {},
      });
      if (error) throw error;
      console.log("Scan complete:", data);
      await loadData();
    } catch (e) {
      console.error("Scan failed:", e);
    } finally {
      setScanning(false);
    }
  };

  // Aggregate totals for latest scan
  const latestSummaries = summaries.filter((s) => s.scan_date === summaries[0]?.scan_date);
  const totalScanned = latestSummaries.reduce((a, s) => a + s.cities_scanned, 0);
  const totalAppearing = latestSummaries.reduce((a, s) => a + s.cities_appearing, 0);
  const totalCited = latestSummaries.reduce((a, s) => a + s.citation_count, 0);
  const overallRate = totalScanned > 0 ? ((totalAppearing / totalScanned) * 100).toFixed(1) : "0";
  const allPositions = cityResults.filter((c) => c.top10lists_position != null);
  const avgPos = allPositions.length > 0
    ? (allPositions.reduce((a, c) => a + (c.top10lists_position || 0), 0) / allPositions.length).toFixed(1)
    : "--";

  const filteredCities = stateFilter === "all"
    ? cityResults
    : cityResults.filter((c) => c.state_slug === stateFilter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">GEO SERP Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Google organic position tracking for Top10Lists.us across qualified cities
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runScan("arizona")}
              disabled={scanning}
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Scan AZ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runScan("california")}
              disabled={scanning}
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Scan CA
            </Button>
            <Button
              size="sm"
              onClick={() => runScan()}
              disabled={scanning}
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Full Scan
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Target className="h-4 w-4" /> SERP Appearance Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{overallRate}%</p>
              <p className="text-xs text-muted-foreground">{totalAppearing} of {totalScanned} cities</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Award className="h-4 w-4" /> Citations Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{totalCited}</p>
              <p className="text-xs text-muted-foreground">Cities where we appear or are cited</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> Avg Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{avgPos}</p>
              <p className="text-xs text-muted-foreground">When appearing (lower is better)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-4 w-4" /> Cities Scanned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{totalScanned}</p>
              <p className="text-xs text-muted-foreground">Last scan: {summaries[0]?.scan_date || "never"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="cities">
          <TabsList>
            <TabsTrigger value="cities">City Breakdown</TabsTrigger>
            <TabsTrigger value="trend">Trend</TabsTrigger>
            <TabsTrigger value="competitors">Top Competitors</TabsTrigger>
          </TabsList>

          {/* City Breakdown Tab */}
          <TabsContent value="cities" className="space-y-4">
            <div className="flex gap-2 items-center">
              <Button
                variant={stateFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStateFilter("all")}
              >
                All States
              </Button>
              <Button
                variant={stateFilter === "arizona" ? "default" : "outline"}
                size="sm"
                onClick={() => setStateFilter("arizona")}
              >
                Arizona
              </Button>
              <Button
                variant={stateFilter === "california" ? "default" : "outline"}
                size="sm"
                onClick={() => setStateFilter("california")}
              >
                California
              </Button>
              <span className="text-xs text-muted-foreground ml-2">
                {filteredCities.length} cities
              </span>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-center">Position</TableHead>
                    <TableHead className="text-center">Cited</TableHead>
                    <TableHead>Our URL</TableHead>
                    <TableHead>#1 Competitor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCities.map((city) => {
                    const comp = city.top_competitors?.[0];
                    return (
                      <TableRow key={`${city.city_name}-${city.state_slug}`}>
                        <TableCell className="font-medium">{city.city_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {city.state_slug === "arizona" ? "AZ" : "CA"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {city.top10lists_position != null ? (
                            <Badge
                              variant={city.top10lists_position <= 3 ? "default" : city.top10lists_position <= 10 ? "secondary" : "outline"}
                            >
                              #{city.top10lists_position}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {city.cited_as_source ? (
                            <Badge variant="default" className="bg-green-600">Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">No</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {city.top10lists_url ? (
                            <a href={city.top10lists_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {city.top10lists_url.replace("https://www.top10lists.us", "")}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Not found</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">
                          {comp ? (
                            <span title={comp.url}>
                              {new URL(comp.url).hostname.replace("www.", "")}
                            </span>
                          ) : "--"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCities.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No scan data yet. Click "Full Scan" to run the first scan.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Trend Tab */}
          <TabsContent value="trend" className="space-y-4">
            {trends.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Run at least 2 scans on different dates to see trends.
              </p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scan Date</TableHead>
                      <TableHead className="text-center">Cities Scanned</TableHead>
                      <TableHead className="text-center">Appearance Rate</TableHead>
                      <TableHead className="text-center">Avg Position</TableHead>
                      <TableHead className="text-center">Citations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trends.map((t) => (
                      <TableRow
                        key={t.scan_date}
                        className={selectedScan === t.scan_date ? "bg-muted/50" : "cursor-pointer hover:bg-muted/30"}
                        onClick={() => loadCityResults(t.scan_date)}
                      >
                        <TableCell className="font-medium">{t.scan_date}</TableCell>
                        <TableCell className="text-center">{t.cities_scanned}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={t.appearance_rate > 20 ? "default" : "secondary"}>
                            {t.appearance_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{t.avg_position ?? "--"}</TableCell>
                        <TableCell className="text-center">{t.citation_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Competitors Tab */}
          <TabsContent value="competitors" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Domains appearing most frequently in #1 position across all scanned cities
            </p>
            <CompetitorBreakdown cityResults={filteredCities} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CompetitorBreakdown({ cityResults }: { cityResults: CityResult[] }) {
  // Count how often each domain appears at #1
  const domainCounts: Record<string, number> = {};
  for (const city of cityResults) {
    const comp = city.top_competitors?.[0];
    if (comp?.url) {
      try {
        const domain = new URL(comp.url).hostname.replace("www.", "");
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch { /* skip bad URLs */ }
    }
  }

  const sorted = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (sorted.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No competitor data yet.</p>;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Domain</TableHead>
            <TableHead className="text-center">#1 Count</TableHead>
            <TableHead className="text-center">% of Cities</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(([domain, count]) => (
            <TableRow key={domain}>
              <TableCell className="font-medium">{domain}</TableCell>
              <TableCell className="text-center">{count}</TableCell>
              <TableCell className="text-center">
                {cityResults.length > 0 ? ((count / cityResults.length) * 100).toFixed(1) : 0}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
