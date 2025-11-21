import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  Activity, 
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProxyMetrics {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  error403Count: number;
  error429Count: number;
  successRate: number;
  lastUpdated: string;
}

interface ProxyHealthAlert {
  provider: string;
  successRate: number;
  totalRequests: number;
  timestamp: string;
}

export function ProxyHealthDashboard() {
  const [metrics, setMetrics] = useState<ProxyMetrics[]>([]);
  const [alerts, setAlerts] = useState<ProxyHealthAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchProxyMetrics = async () => {
    try {
      // Fetch proxy metrics from marketing_content
      const { data: metricsData } = await supabase
        .from('marketing_content')
        .select('*')
        .eq('page', 'admin')
        .eq('section', 'proxy_metrics')
        .order('updated_at', { ascending: false });

      if (metricsData) {
        const parsedMetrics: ProxyMetrics[] = metricsData.map((item: any) => {
          try {
            const data = JSON.parse(item.value);
            return {
              provider: item.key,
              totalRequests: data.totalRequests || 0,
              successfulRequests: data.successfulRequests || 0,
              failedRequests: data.failedRequests || 0,
              error403Count: data.error403Count || 0,
              error429Count: data.error429Count || 0,
              successRate: data.totalRequests > 0 
                ? ((data.successfulRequests / data.totalRequests) * 100) 
                : 0,
              lastUpdated: item.updated_at
            };
          } catch {
            return null;
          }
        }).filter(Boolean) as ProxyMetrics[];

        setMetrics(parsedMetrics);

        // Check for unhealthy proxies (< 70% success rate)
        const unhealthyProxies = parsedMetrics
          .filter(m => m.successRate < 70 && m.totalRequests >= 10)
          .map(m => ({
            provider: m.provider,
            successRate: m.successRate,
            totalRequests: m.totalRequests,
            timestamp: m.lastUpdated
          }));

        setAlerts(unhealthyProxies);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching proxy metrics:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProxyMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchProxyMetrics, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getHealthStatus = (successRate: number) => {
    if (successRate >= 90) return { status: 'Excellent', color: 'text-green-500', icon: CheckCircle2 };
    if (successRate >= 70) return { status: 'Good', color: 'text-blue-500', icon: Activity };
    if (successRate >= 50) return { status: 'Fair', color: 'text-yellow-500', icon: AlertTriangle };
    return { status: 'Poor', color: 'text-red-500', icon: XCircle };
  };

  const overallStats = metrics.reduce(
    (acc, m) => ({
      totalRequests: acc.totalRequests + m.totalRequests,
      successfulRequests: acc.successfulRequests + m.successfulRequests,
      failedRequests: acc.failedRequests + m.failedRequests,
      error403Count: acc.error403Count + m.error403Count,
      error429Count: acc.error429Count + m.error429Count
    }),
    { totalRequests: 0, successfulRequests: 0, failedRequests: 0, error403Count: 0, error429Count: 0 }
  );

  const overallSuccessRate = overallStats.totalRequests > 0
    ? ((overallStats.successfulRequests / overallStats.totalRequests) * 100)
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Proxy Health Monitoring</h2>
          <p className="text-sm text-muted-foreground">Real-time proxy performance and success rates</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
          {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
        </Button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Proxy Health Warnings</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {alerts.map((alert) => (
                <p key={alert.provider}>
                  <strong>{alert.provider}</strong>: {alert.successRate.toFixed(1)}% success rate 
                  ({alert.totalRequests} requests) - Consider switching providers
                </p>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">{overallStats.totalRequests.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{overallStats.successfulRequests.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-2xl font-bold">{overallStats.failedRequests.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              403 Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-2xl font-bold">{overallStats.error403Count.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rate Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{overallStats.error429Count.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Success Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Success Rate</CardTitle>
          <CardDescription>
            {overallStats.successfulRequests.toLocaleString()} of {overallStats.totalRequests.toLocaleString()} requests successful
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={overallSuccessRate} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {overallSuccessRate.toFixed(1)}% success rate
          </p>
        </CardContent>
      </Card>

      {/* Provider Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Proxy Provider Performance</CardTitle>
          <CardDescription>Success rates and error details by provider</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {metrics.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No proxy metrics available yet. Run some enrichments to see data.
              </p>
            ) : (
              metrics.map((metric) => {
                const health = getHealthStatus(metric.successRate);
                const HealthIcon = health.icon;
                
                return (
                  <div key={metric.provider} className="space-y-3 p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <HealthIcon className={`h-5 w-5 ${health.color}`} />
                        <div>
                          <h3 className="font-semibold">{metric.provider}</h3>
                          <p className="text-xs text-muted-foreground">
                            Last updated: {new Date(metric.lastUpdated).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={metric.successRate >= 70 ? "default" : "destructive"}>
                          {health.status}
                        </Badge>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{metric.successRate.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">success rate</p>
                        </div>
                      </div>
                    </div>
                    
                    <Progress value={metric.successRate} className="h-2" />
                    
                    <div className="grid grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">{metric.totalRequests}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Success</p>
                        <p className="font-medium text-green-500">{metric.successfulRequests}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Failed</p>
                        <p className="font-medium text-red-500">{metric.failedRequests}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">403s</p>
                        <p className="font-medium text-orange-500">{metric.error403Count}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">429s</p>
                        <p className="font-medium text-blue-500">{metric.error429Count}</p>
                      </div>
                    </div>

                    {/* Trend indicator */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {metric.successRate >= 70 ? (
                        <>
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span>Healthy proxy performance</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-3 w-3 text-red-500" />
                          <span>Consider switching or investigating this proxy</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
