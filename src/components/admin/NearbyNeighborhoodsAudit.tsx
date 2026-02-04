/**
 * Admin tool to audit and fix nearby neighborhoods data
 * Identifies bad matches (wrong city/state, incorrect distances)
 */

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, AlertTriangle, CheckCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface AuditResult {
  neighborhood_id: string;
  neighborhood_name: string;
  city: string;
  state: string;
  issues: {
    nearby_name: string;
    nearby_city: string;
    nearby_state: string;
    problem: string;
  }[];
}

export default function NearbyNeighborhoodsAudit() {
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);

  const runAudit = async () => {
    setLoading(true);
    setResults([]);
    
    try {
      toast.info('Running audit... This may take a few minutes');
      
      // Paginate to get ALL neighborhoods (not just 1,000)
      const neighborhoods = [];
      const pageSize = 1000;
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from('neighborhood_catalog')
          .select('id, neighborhood, city_area, state, nearby_neighborhoods')
          .eq('is_active', true)
          .not('nearby_neighborhoods', 'is', null)
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        neighborhoods.push(...data);
        console.log(`Fetched ${neighborhoods.length} neighborhoods...`);

        if (data.length < pageSize) break;
        offset += pageSize;
      }
      
      const issues: AuditResult[] = [];
      let totalChecked = 0;
      
      console.log(`Checking ${neighborhoods.length} neighborhoods...`);
      
      for (const neighborhood of neighborhoods) {
        totalChecked++;
        const nearbyList = neighborhood.nearby_neighborhoods;
        
        if (!Array.isArray(nearbyList) || nearbyList.length === 0) continue;
        
        const neighborhoodIssues: AuditResult['issues'] = [];
        
        // Check each nearby neighborhood
        for (const nearby of nearbyList) {
          const nearbyName = typeof nearby === 'string' ? nearby : nearby.name || nearby.neighborhood;
          
          // Find this neighborhood in the catalog
          const { data: nearbyData } = await supabase
            .from('neighborhood_catalog')
            .select('neighborhood, city_area, state, lat, lon')
            .ilike('neighborhood', nearbyName)
            .limit(10);
          
          if (!nearbyData || nearbyData.length === 0) {
            neighborhoodIssues.push({
              nearby_name: nearbyName,
              nearby_city: 'Unknown',
              nearby_state: 'Unknown',
              problem: 'Neighborhood not found in catalog'
            });
            continue;
          }
          
          // Check if any match is in the same state
          const sameState = nearbyData.find(n => 
            n.state.toLowerCase() === neighborhood.state.toLowerCase()
          );
          
          if (!sameState) {
            // Different state - this is a real problem
            const closest = nearbyData[0];
            neighborhoodIssues.push({
              nearby_name: nearbyName,
              nearby_city: closest.city_area,
              nearby_state: closest.state,
              problem: `WRONG STATE: ${closest.state} (should be ${neighborhood.state})`
            });
          }
          // Note: Different cities in the same state are OK (e.g., Phoenix/Scottsdale border)
        }
        
        if (neighborhoodIssues.length > 0) {
          issues.push({
            neighborhood_id: neighborhood.id,
            neighborhood_name: neighborhood.neighborhood,
            city: neighborhood.city_area,
            state: neighborhood.state,
            issues: neighborhoodIssues
          });
        }
      }
      
      setResults(issues);
      toast.success(`Audit complete! Found ${issues.length} neighborhoods with issues (checked ${totalChecked} total)`);
      
    } catch (error: any) {
      console.error('[Audit] Error:', error);
      toast.error(error.message || 'Audit failed');
    } finally {
      setLoading(false);
    }
  };

  const fixAllIssues = async () => {
    if (!confirm(`This will recalculate nearby neighborhoods for ${results.length} neighborhoods with issues. Continue?`)) {
      return;
    }
    
    setFixing(true);
    try {
      toast.info('Fixing neighborhoods... This will take a while');
      
      let fixed = 0;
      let failed = 0;
      
      for (const result of results) {
        try {
          // Call the enrichment API to recalculate nearby neighborhoods with the fix
          const { data, error } = await supabase.functions.invoke('enrichment-api', {
            body: {
              action: 'recompute-nearby',
              id: result.neighborhood_id
            }
          });
          
          if (error) throw error;
          fixed++;
        } catch (err) {
          console.error(`Failed to fix ${result.neighborhood_name}:`, err);
          failed++;
        }
      }
      
      toast.success(`Fixed ${fixed} neighborhoods${failed > 0 ? `, ${failed} failed` : ''}`);
      
      // Re-run audit
      await runAudit();
      
    } catch (error: any) {
      console.error('[Fix] Error:', error);
      toast.error(error.message || 'Fix failed');
    } finally {
      setFixing(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6" />
            Nearby Neighborhoods Audit
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Check for neighborhoods matched to wrong states (adjacent cities in same state are allowed)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runAudit} disabled={loading || fixing}>
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            Run Audit
          </Button>
          {results.length > 0 && (
            <Button 
              onClick={fixAllIssues} 
              disabled={loading || fixing}
              variant="destructive"
            >
              {fixing ? <Loader2 className="animate-spin mr-2" /> : null}
              Fix All Issues
            </Button>
          )}
        </div>
      </div>

      {results.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
          <p>Click "Run Audit" to check for issues</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">
                  {results.length} neighborhoods with issues found
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  These neighborhoods have nearby suggestions in wrong states (adjacent cities in same state are OK)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {results.map((result, idx) => (
              <div key={idx} className="bg-white rounded-lg border p-4">
                <div className="font-semibold text-lg mb-2">
                  {result.neighborhood_name}
                  <span className="text-sm text-muted-foreground ml-2">
                    ({result.city}, {result.state})
                  </span>
                </div>
                
                <div className="space-y-2 ml-4">
                  {result.issues.map((issue, issueIdx) => (
                    <div 
                      key={issueIdx} 
                      className={`text-sm p-2 rounded ${
                        issue.problem.includes('WRONG STATE') 
                          ? 'bg-red-50 border border-red-200' 
                          : 'bg-amber-50 border border-amber-200'
                      }`}
                    >
                      <span className="font-medium">{issue.nearby_name}</span>
                      {' → '}
                      <span className="text-muted-foreground">
                        {issue.nearby_city}, {issue.nearby_state}
                      </span>
                      <div className={`text-xs mt-1 ${
                        issue.problem.includes('WRONG STATE') ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {issue.problem}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
