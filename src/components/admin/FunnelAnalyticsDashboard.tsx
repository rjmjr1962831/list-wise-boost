import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, MousePointer, Eye, Edit, CreditCard, CheckCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface FunnelStage {
  name: string;
  count: number;
  icon: React.ReactNode;
  color: string;
}

interface AgentActivity {
  name: string;
  email: string;
  short_code: string;
  funnel_status: string;
  verification_started_at: string | null;
  funnel_started_at: string | null;
  checkout_started_at: string | null;
  funnel_completed_at: string | null;
  last_event: string;
  last_event_at: string;
}

export function FunnelAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [recentActivity, setRecentActivity] = useState<AgentActivity[]>([]);
  const [stats, setStats] = useState({
    totalClicks: 0,
    startedFunnel: 0,
    viewedPricing: 0,
    completedCheckout: 0,
    conversionRate: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get funnel stage counts
      const { data: professionals, error: profError } = await supabase
        .from('professionals')
        .select('id, name, email, short_code, funnel_status, verification_started_at, funnel_started_at, checkout_started_at, funnel_completed_at')
        .not('verification_started_at', 'is', null)
        .order('verification_started_at', { ascending: false });

      if (profError) throw profError;

      // Get recent funnel events
      const { data: events, error: eventsError } = await supabase
        .from('funnel_events')
        .select(`
          event_name,
          created_at,
          professional_id,
          professionals!inner(name, email, short_code)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (eventsError) throw eventsError;

      // Calculate stage counts
      const clicked = professionals?.length || 0;
      const startedFunnel = professionals?.filter(p => p.funnel_started_at).length || 0;
      const viewedPricing = events?.filter(e => e.event_name === 'pricing_viewed').length || 0;
      const checkoutStarted = professionals?.filter(p => p.checkout_started_at).length || 0;
      const completed = professionals?.filter(p => p.funnel_completed_at).length || 0;

      setStats({
        totalClicks: clicked,
        startedFunnel,
        viewedPricing,
        completedCheckout: completed,
        conversionRate: clicked > 0 ? Math.round((completed / clicked) * 100) : 0
      });

      setStages([
        { name: 'Magic Link Clicked', count: clicked, icon: <MousePointer className="h-4 w-4" />, color: 'bg-blue-500' },
        { name: 'Funnel Started', count: startedFunnel, icon: <Eye className="h-4 w-4" />, color: 'bg-indigo-500' },
        { name: 'Viewed Pricing', count: viewedPricing, icon: <CreditCard className="h-4 w-4" />, color: 'bg-purple-500' },
        { name: 'Checkout Started', count: checkoutStarted, icon: <Edit className="h-4 w-4" />, color: 'bg-amber-500' },
        { name: 'Completed', count: completed, icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-500' },
      ]);

      // Build recent activity with last event
      const activityMap = new Map<string, AgentActivity>();
      
      professionals?.forEach(p => {
        activityMap.set(p.id, {
          name: p.name,
          email: p.email || '',
          short_code: p.short_code || '',
          funnel_status: p.funnel_status || 'unknown',
          verification_started_at: p.verification_started_at,
          funnel_started_at: p.funnel_started_at,
          checkout_started_at: p.checkout_started_at,
          funnel_completed_at: p.funnel_completed_at,
          last_event: 'magic_link_clicked',
          last_event_at: p.verification_started_at || ''
        });
      });

      // Overlay events
      events?.forEach((e: any) => {
        if (e.professional_id && activityMap.has(e.professional_id)) {
          const existing = activityMap.get(e.professional_id)!;
          if (new Date(e.created_at) > new Date(existing.last_event_at)) {
            existing.last_event = e.event_name;
            existing.last_event_at = e.created_at;
          }
        }
      });

      // Sort by last event
      const sortedActivity = Array.from(activityMap.values())
        .sort((a, b) => new Date(b.last_event_at).getTime() - new Date(a.last_event_at).getTime())
        .slice(0, 20);

      setRecentActivity(sortedActivity);

    } catch (err: any) {
      console.error('Error fetching funnel data:', err);
      toast.error('Failed to load funnel data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'NA';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const getEventBadgeColor = (event: string) => {
    switch (event) {
      case 'pricing_viewed': return 'bg-purple-100 text-purple-800';
      case 'funnel_started': return 'bg-blue-100 text-blue-800';
      case 'see_listing_clicked': return 'bg-indigo-100 text-indigo-800';
      case 'profile_edit_viewed': return 'bg-amber-100 text-amber-800';
      case 'welcome_viewed': return 'bg-slate-100 text-slate-800';
      case 'checkout_started': return 'bg-orange-100 text-orange-800';
      case 'checkout_completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'welcome': return <Badge variant="secondary">Welcome</Badge>;
      case 'editing': return <Badge className="bg-amber-500">Editing</Badge>;
      case 'approved': return <Badge className="bg-indigo-500">Approved</Badge>;
      case 'checkout': return <Badge className="bg-purple-500">Checkout</Badge>;
      case 'subscribed': return <Badge className="bg-green-500">Subscribed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Funnel Analytics</h2>
          <p className="text-muted-foreground">Track agent progression through the signup funnel</p>
        </div>
        <Button onClick={fetchData} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stages.map((stage, i) => (
          <Card key={stage.name}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded ${stage.color} text-white`}>
                  {stage.icon}
                </div>
                <span className="text-2xl font-bold">{stage.count}</span>
              </div>
              <p className="text-sm text-muted-foreground">{stage.name}</p>
              {i > 0 && stages[i-1].count > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((stage.count / stages[i-1].count) * 100)}% from prev
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Overall Conversion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold">{stats.conversionRate}%</span>
            <span className="text-muted-foreground">
              {stats.completedCheckout} of {stats.totalClicks} agents who clicked converted
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Agent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No activity yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Agent</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Last Event</th>
                    <th className="text-left py-2 px-2">When</th>
                    <th className="text-left py-2 px-2">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((activity, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2">
                        <div>
                          <div className="font-medium">{activity.name}</div>
                          <div className="text-xs text-muted-foreground">{activity.email}</div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {getStatusBadge(activity.funnel_status)}
                      </td>
                      <td className="py-2 px-2">
                        <Badge className={getEventBadgeColor(activity.last_event)}>
                          {activity.last_event.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {formatDate(activity.last_event_at)}
                      </td>
                      <td className="py-2 px-2">
                        {activity.short_code && (
                          <a 
                            href={`https://www.top10lists.us/p/${activity.short_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
