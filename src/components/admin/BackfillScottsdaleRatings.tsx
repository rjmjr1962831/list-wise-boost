import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export function BackfillScottsdaleRatings() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [stats, setStats] = useState<{
    before: { enriched: number; qualifying: number };
    after: { enriched: number; qualifying: number };
  } | null>(null);

  const handleBackfill = async () => {
    try {
      setIsRunning(true);
      setProgress(0);
      setUpdated(0);
      
      toast.info('Starting ratings backfill...');
      
      const scottsdaleId = 'afe374d7-0de5-4574-99bc-1a596df7d995';
      const categoryId = '1384f127-fc2e-4693-9b8f-406451adf3aa';

      // Get stats before backfill
      const { data: beforeData } = await supabase
        .from('professionals')
        .select('review_stars_rating, num_total_reviews', { count: 'exact' })
        .eq('city_id', scottsdaleId)
        .eq('category_id', categoryId)
        .eq('active', true)
        .not('ratings', 'is', null);

      const beforeQualifying = beforeData?.filter(
        a => a.review_stars_rating && a.review_stars_rating >= 4.9 && 
             a.num_total_reviews && a.num_total_reviews >= 200
      ).length || 0;

      console.log(`Before backfill: ${beforeData?.length || 0} enriched, ${beforeQualifying} qualifying`);

      // Find agents with ratings JSON but missing review_stars_rating or num_total_reviews
      const { data: agents, error: fetchError } = await supabase
        .from('professionals')
        .select('id, name, ratings, review_stars_rating, num_total_reviews')
        .eq('city_id', scottsdaleId)
        .eq('category_id', categoryId)
        .eq('active', true)
        .not('ratings', 'is', null);

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        toast.error('Failed to fetch agents: ' + fetchError.message);
        return;
      }

      if (!agents || agents.length === 0) {
        toast.info('No agents found with ratings data');
        return;
      }

      // Filter for agents that need backfill
      const needsBackfill = agents.filter(agent => {
        const hasRatingsJson = agent.ratings && 
          typeof agent.ratings === 'object' && 
          'average' in agent.ratings && 
          'count' in agent.ratings;
        const missingFields = !agent.review_stars_rating || !agent.num_total_reviews;
        return hasRatingsJson && missingFields;
      });

      console.log(`Found ${needsBackfill.length} agents needing backfill out of ${agents.length} total`);
      setTotal(needsBackfill.length);

      if (needsBackfill.length === 0) {
        toast.success('All agents already have rating fields populated!');
        setIsRunning(false);
        return;
      }

      // Process each agent
      let updatedCount = 0;
      for (let i = 0; i < needsBackfill.length; i++) {
        const agent = needsBackfill[i];
        const ratings = agent.ratings as { average?: number; count?: number };
        
        if (ratings.average !== undefined || ratings.count !== undefined) {
          const updateData: any = {};
          
          if (ratings.average !== undefined && !agent.review_stars_rating) {
            updateData.review_stars_rating = ratings.average;
          }
          
          if (ratings.count !== undefined && !agent.num_total_reviews) {
            updateData.num_total_reviews = ratings.count;
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from('professionals')
              .update(updateData)
              .eq('id', agent.id);

            if (updateError) {
              console.error(`Failed to update ${agent.name}:`, updateError);
            } else {
              updatedCount++;
              console.log(`✅ Updated ${agent.name}: ${ratings.average}★ (${ratings.count} reviews)`);
            }
          }
        }

        setProgress(((i + 1) / needsBackfill.length) * 100);
        setUpdated(updatedCount);
      }

      // Get stats after backfill
      const { data: afterData } = await supabase
        .from('professionals')
        .select('review_stars_rating, num_total_reviews', { count: 'exact' })
        .eq('city_id', scottsdaleId)
        .eq('category_id', categoryId)
        .eq('active', true)
        .not('ratings', 'is', null);

      const afterQualifying = afterData?.filter(
        a => a.review_stars_rating && a.review_stars_rating >= 4.9 && 
             a.num_total_reviews && a.num_total_reviews >= 200
      ).length || 0;

      console.log(`After backfill: ${afterData?.length || 0} enriched, ${afterQualifying} qualifying`);

      setStats({
        before: { enriched: beforeData?.length || 0, qualifying: beforeQualifying },
        after: { enriched: afterData?.length || 0, qualifying: afterQualifying }
      });

      toast.success(`Backfill complete! Updated ${updatedCount} agents. Qualifying agents: ${beforeQualifying} → ${afterQualifying}`);
    } catch (error: any) {
      console.error('Backfill error:', error);
      toast.error('Backfill failed: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backfill Scottsdale Ratings</CardTitle>
        <CardDescription>
          Extract rating and review count from ratings JSON object for enriched agents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>This will:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Find Scottsdale agents with ratings JSON but null review_stars_rating/num_total_reviews</li>
            <li>Extract average and count from the ratings object</li>
            <li>Update review_stars_rating and num_total_reviews fields</li>
            <li>Show before/after qualifying agent counts (4.9+ stars, 200+ reviews)</li>
          </ul>
        </div>

        {stats && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-semibold">Backfill Results</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Before:</div>
                <div>{stats.before.enriched} enriched</div>
                <div className="font-semibold">{stats.before.qualifying} qualifying</div>
              </div>
              <div>
                <div className="text-muted-foreground">After:</div>
                <div>{stats.after.enriched} enriched</div>
                <div className="font-semibold text-green-600">{stats.after.qualifying} qualifying</div>
              </div>
            </div>
          </div>
        )}

        {isRunning && total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress: {updated} / {total} agents updated</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}
        
        <Button 
          onClick={handleBackfill}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Backfilling... ({updated}/{total})
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Start Ratings Backfill
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
