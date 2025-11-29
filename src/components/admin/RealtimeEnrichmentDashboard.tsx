import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QueueItem {
  id: string;
  professional_id: string;
  status: string;
  stage: string;
  attempts: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  professionals: {
    name: string;
  };
}

const stageConfig = {
  queued: { label: 'Queued', icon: Clock, color: 'bg-gray-500' },
  memo23: { label: 'Memo23', icon: Loader2, color: 'bg-blue-500 animate-pulse' },
  press_research: { label: 'Press Research', icon: Loader2, color: 'bg-purple-500 animate-pulse' },
  synthesis: { label: 'Synthesis', icon: Loader2, color: 'bg-green-500 animate-pulse' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-emerald-500' },
};

const statusConfig = {
  pending: { color: 'secondary', label: 'Pending' },
  processing: { color: 'default', label: 'Processing' },
  completed: { color: 'default', label: 'Completed' },
  failed: { color: 'destructive', label: 'Failed' },
};

export function RealtimeEnrichmentDashboard() {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });

  useEffect(() => {
    // Initial load
    loadQueueItems();

    // Set up realtime subscription
    const channel = supabase
      .channel('enrichment-queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_enrichment_queue',
        },
        () => {
          // Reload data on any change
          loadQueueItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadQueueItems = async () => {
    // Get recent queue items
    const { data: items } = await supabase
      .from('contact_enrichment_queue')
      .select('*, professionals(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (items) {
      setQueueItems(items as QueueItem[]);

      // Calculate stats
      const newStats = {
        pending: items.filter(i => i.status === 'pending').length,
        processing: items.filter(i => i.status === 'processing').length,
        completed: items.filter(i => i.status === 'completed').length,
        failed: items.filter(i => i.status === 'failed').length,
      };
      setStats(newStats);
    }
  };

  const getTimeSince = (timestamp: string | null) => {
    if (!timestamp) return null;
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getStageDuration = (item: QueueItem) => {
    if (item.status !== 'processing' || !item.started_at) return null;
    const seconds = Math.floor((Date.now() - new Date(item.started_at).getTime()) / 1000);
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Real-Time Enrichment Progress</h2>
        <p className="text-muted-foreground">Live tracking of agent enrichment pipeline</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-secondary/50">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
        </Card>
        <Card className="p-4 bg-secondary/50">
          <div className="text-sm text-muted-foreground">Processing</div>
          <div className="text-3xl font-bold text-blue-600">{stats.processing}</div>
        </Card>
        <Card className="p-4 bg-secondary/50">
          <div className="text-sm text-muted-foreground">Completed</div>
          <div className="text-3xl font-bold text-emerald-600">{stats.completed}</div>
        </Card>
        <Card className="p-4 bg-secondary/50">
          <div className="text-sm text-muted-foreground">Failed</div>
          <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
        </Card>
      </div>

      {/* Queue Items */}
      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-3">
          {queueItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No agents in enrichment queue</p>
            </div>
          ) : (
            queueItems.map((item) => {
              const stage = stageConfig[item.stage as keyof typeof stageConfig] || stageConfig.queued;
              const StageIcon = stage.icon;
              const statusCfg = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.pending;

              return (
                <Card key={item.id} className="p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold truncate">
                          {item.professionals?.name || 'Unknown Agent'}
                        </h3>
                        <Badge variant={statusCfg.color as any}>
                          {statusCfg.label}
                        </Badge>
                      </div>

                      {/* Stage Progress */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                        <StageIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{stage.label}</span>
                        {item.status === 'processing' && (
                          <span className="text-xs text-muted-foreground">
                            ({getStageDuration(item)})
                          </span>
                        )}
                      </div>

                      {/* Stage Timeline */}
                      <div className="flex items-center gap-1 mt-3">
                        {['queued', 'memo23', 'press_research', 'synthesis', 'completed'].map((stageName, idx) => {
                          const isActive = item.stage === stageName;
                          const isPast = ['queued', 'memo23', 'press_research', 'synthesis', 'completed'].indexOf(item.stage) > idx;
                          
                          return (
                            <div key={stageName} className="flex items-center flex-1">
                              <div 
                                className={`h-2 rounded-full flex-1 transition-all ${
                                  isPast ? 'bg-emerald-500' : 
                                  isActive ? 'bg-blue-500 animate-pulse' : 
                                  'bg-gray-200 dark:bg-gray-700'
                                }`}
                              />
                              {idx < 4 && (
                                <div className="w-1 h-2 bg-background" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Error Message */}
                      {item.error_message && (
                        <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
                          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{item.error_message}</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="text-right text-xs text-muted-foreground space-y-1">
                      <div>Attempt {item.attempts}/3</div>
                      {item.created_at && (
                        <div title={new Date(item.created_at).toLocaleString()}>
                          {getTimeSince(item.created_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Pipeline Legend */}
      <div className="mt-6 pt-6 border-t">
        <h3 className="text-sm font-semibold mb-3">Pipeline Stages</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span>Queued</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Memo23 (2-3m)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Press (30s)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Synthesis (10s)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Completed</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
