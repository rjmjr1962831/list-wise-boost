import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, TrendingUp, DollarSign, AlertTriangle, Users } from 'lucide-react';
import { format } from 'date-fns';

interface FunnelMetrics {
  total_started: number;
  total_edited: number;
  total_approved: number;
  total_subscribed: number;
  total_churned: number;
}

interface PaymentTransaction {
  id: string;
  professional_id: string;
  professional_name?: string;
  event_type: string;
  amount_cents: number;
  status: string;
  promo_code: string | null;
  cities_purchased: string[] | null;
  package_name: string | null;
  created_at: string;
}

interface FailedPayment {
  id: string;
  professional_id: string;
  professional_name?: string;
  professional_email?: string;
  amount_cents: number;
  failure_reason: string | null;
  created_at: string;
}

export function FunnelPaymentDashboard() {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<FunnelMetrics | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Funnel stages
      const { data: professionals } = await supabase
        .from('professionals')
        .select('funnel_status, funnel_started_at, subscription_status')
        .eq('active', true);

      if (professionals) {
        setMetrics({
          total_started: professionals.filter(p => p.funnel_started_at).length,
          total_edited: professionals.filter(p => 
            p.funnel_status === 'editing' || 
            p.funnel_status === 'approved' || 
            p.funnel_status === 'subscribed'
          ).length,
          total_approved: professionals.filter(p => 
            p.funnel_status === 'approved' || 
            p.funnel_status === 'subscribed'
          ).length,
          total_subscribed: professionals.filter(p => p.subscription_status === 'active').length,
          total_churned: professionals.filter(p => p.subscription_status === 'canceled').length,
        });
      }

      // Recent transactions
      const { data: txns } = await supabase
        .from('payment_transactions')
        .select('*, professionals(name)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (txns) {
        setTransactions(txns.map(t => ({
          ...t,
          professional_name: (t as any).professionals?.name || 'Unknown'
        })));
      }

      // Failed payments
      const { data: failed } = await supabase
        .from('payment_transactions')
        .select('*, professionals(name, email)')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (failed) {
        setFailedPayments(failed.map(f => ({
          ...f,
          professional_name: (f as any).professionals?.name || 'Unknown',
          professional_email: (f as any).professionals?.email || ''
        })));
      }

      // Recent funnel events
      const { data: events } = await supabase
        .from('funnel_events')
        .select('*, professionals(name)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (events) {
        setRecentEvents(events.map(e => ({
          ...e,
          professional_name: (e as any).professionals?.name || 'Unknown'
        })));
      }

    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge className="bg-green-500/20 text-green-700">Succeeded</Badge>;
      case 'failed':
        return <Badge className="bg-yellow-500/20 text-yellow-700">Failed</Badge>;
      case 'refunded':
        return <Badge className="bg-orange-500/20 text-orange-700">Refunded</Badge>;
      case 'canceled':
        return <Badge className="bg-gray-500/20 text-gray-700">Canceled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Funnel & Payment Dashboard</h2>
        <Button onClick={fetchMetrics} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Funnel Started</CardDescription>
              <CardTitle className="text-2xl">{metrics.total_started}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Edited Profile</CardDescription>
              <CardTitle className="text-2xl">{metrics.total_edited}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved</CardDescription>
              <CardTitle className="text-2xl">{metrics.total_approved}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Active Subscribers
              </CardDescription>
              <CardTitle className="text-2xl text-green-600">{metrics.total_subscribed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Churned
              </CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{metrics.total_churned}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="failed">
            Failed Payments
            {failedPayments.length > 0 && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-700">{failedPayments.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events">Funnel Events</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Transactions</CardTitle>
              <CardDescription>Recent payment activity across all agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No transactions yet</p>
                ) : (
                  transactions.map(txn => (
                    <div key={txn.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">{txn.professional_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {txn.event_type} • {txn.package_name || 'Direct'}
                          {txn.promo_code && <span className="ml-2 text-primary">🎟️ {txn.promo_code}</span>}
                        </p>
                        {txn.cities_purchased && txn.cities_purchased.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Cities: {txn.cities_purchased.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-semibold">{formatCurrency(txn.amount_cents)}</p>
                        {getStatusBadge(txn.status)}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(txn.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Failed Payments
              </CardTitle>
              <CardDescription>Payments that need attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {failedPayments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No failed payments</p>
                ) : (
                  failedPayments.map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border border-yellow-200 bg-yellow-50/50 rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">{payment.professional_name}</p>
                        <p className="text-sm text-muted-foreground">{payment.professional_email}</p>
                        <p className="text-xs text-yellow-700">{payment.failure_reason || 'Unknown reason'}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-semibold">{formatCurrency(payment.amount_cents)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(payment.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Funnel Events</CardTitle>
              <CardDescription>Agent journey through the funnel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentEvents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No events yet</p>
                ) : (
                  recentEvents.map(event => (
                    <div key={event.id} className="flex items-center justify-between p-2 border-b last:border-0">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{event.professional_name}</p>
                        <p className="text-xs">
                          <Badge variant="outline" className="text-xs">
                            {event.event_name}
                          </Badge>
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
