/**
 * Admin tool for testing the neighborhood selection funnel
 * Allows quick access to test the funnel with specific accounts
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CopyableLink, CopyableText } from '@/components/ui/copyable-link';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  verification_token: string | null;
  company: string | null;
}

export default function FunnelTestingTool() {
  const [loading, setLoading] = useState(false);
  const [testAccount, setTestAccount] = useState<Professional | null>(null);
  const [searchQuery, setSearchQuery] = useState('robert maynard');
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Auto-load Robert Maynard on mount
  useEffect(() => {
    handleSearch('robert maynard');
  }, []);

  const handleSearch = async (query: string = searchQuery) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, email, verification_token, company')
        .ilike('name', `%${query}%`)
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        setTestAccount(data);
        toast.success(`Found: ${data.name}`);
      } else {
        toast.error('Account not found');
        setTestAccount(null);
      }
    } catch (error: any) {
      console.error('Error searching:', error);
      toast.error(error.message || 'Failed to find account');
      setTestAccount(null);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!testAccount?.verification_token) return;
    
    setLoadingAnalytics(true);
    try {
      const { data, error } = await supabase
        .from('funnel_analytics')
        .select('*')
        .eq('event_properties->>token', testAccount.verification_token)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAnalytics(data || []);
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const clearAnalytics = async () => {
    if (!testAccount?.verification_token) return;
    
    if (!confirm('Clear all analytics for this test account?')) return;
    
    try {
      const { error } = await supabase
        .from('funnel_analytics')
        .delete()
        .eq('event_properties->>token', testAccount.verification_token);

      if (error) throw error;
      
      toast.success('Analytics cleared');
      setAnalytics([]);
    } catch (error: any) {
      console.error('Error clearing analytics:', error);
      toast.error('Failed to clear analytics');
    }
  };


  const getFunnelUrl = (step: string) => {
    if (!testAccount?.verification_token) return '';
    const baseUrl = window.location.origin;
    
    switch (step) {
      case 'select-neighborhoods':
        return `${baseUrl}/profile/${testAccount.verification_token}/select-neighborhoods`;
      case 'select-neighborhoods-arcadia':
        return `${baseUrl}/profile/${testAccount.verification_token}/select-neighborhoods?preselect=arcadia&city=phoenix`;
      case 'checkout':
        return `${baseUrl}/profile/${testAccount.verification_token}/checkout`;
      default:
        return baseUrl;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Funnel Testing Tool</h2>
        
        {/* Search for Test Account */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Search for Agent</label>
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter agent name..."
              className="flex-1"
            />
            <Button onClick={() => handleSearch()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Search'}
            </Button>
          </div>
        </div>

        {/* Test Account Info */}
        {testAccount && (
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{testAccount.name}</h3>
                {testAccount.company && (
                  <p className="text-sm text-slate-600">{testAccount.company}</p>
                )}
                {testAccount.email && (
                  <p className="text-sm text-slate-500">{testAccount.email}</p>
                )}
              </div>
              <CheckCircle className="text-green-500" />
            </div>

            {testAccount.verification_token ? (
              <CopyableText
                text={testAccount.verification_token}
                label="Verification Token"
                className="mt-2"
              />
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">No verification token found</span>
              </div>
            )}
          </div>
        )}

        {/* Quick Links */}
        {testAccount?.verification_token && (
          <div className="space-y-4">
            <h3 className="font-semibold">Test Funnel Links</h3>
            
            <div className="space-y-3">
              <CopyableLink
                url={getFunnelUrl('select-neighborhoods')}
                label="Neighborhood Selection (Clean)"
                showOpenButton={true}
              />
              
              <CopyableLink
                url={getFunnelUrl('select-neighborhoods-arcadia')}
                label="Neighborhood Selection (Arcadia Preselected)"
                showOpenButton={true}
              />
              
              <CopyableLink
                url={getFunnelUrl('checkout')}
                label="Checkout Page"
                showOpenButton={true}
              />
            </div>
          </div>
        )}

        {/* Analytics Section */}
        {testAccount?.verification_token && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Analytics Events</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadAnalytics}
                  disabled={loadingAnalytics}
                >
                  {loadingAnalytics ? <Loader2 className="animate-spin w-4 h-4" /> : 'Refresh'}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={clearAnalytics}
                >
                  Clear Analytics
                </Button>
              </div>
            </div>

            {analytics.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {analytics.map((event, idx) => (
                  <div key={idx} className="bg-white rounded border p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-primary">{event.event_name}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                    {event.event_properties && (
                      <pre className="text-xs text-slate-600 overflow-x-auto">
                        {JSON.stringify(event.event_properties, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No analytics events yet</p>
                <p className="text-sm">Test the funnel to see events appear here</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

