/**
 * Cache Invalidation Service
 * Manages cache invalidation queue for canonical rankings
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Queues a city/category for cache invalidation
 * This will trigger regeneration of canonical rankings
 */
export async function queueCacheInvalidation(
  cityId: string,
  categoryId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('cache_invalidation_queue')
      .insert({
        city_id: cityId,
        category_id: categoryId,
        reason,
        status: 'pending'
      });

    if (error) {
      console.error('Error queueing cache invalidation:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Queued cache invalidation for city: ${cityId}, category: ${categoryId}`);
    return { success: true };
  } catch (error) {
    console.error('Error in queueCacheInvalidation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Manually triggers cache invalidation processing
 * Useful for admin dashboard or immediate invalidation needs
 */
export async function triggerCacheInvalidationNow(): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const { data, error } = await supabase.functions.invoke('process-cache-invalidation', {
      body: {}
    });

    if (error) {
      console.error('Error triggering cache invalidation:', error);
      return { success: false, error: error.message };
    }

    console.log('Cache invalidation triggered:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error in triggerCacheInvalidationNow:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Gets current cache invalidation queue status
 */
export async function getCacheQueueStatus(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  try {
    const { data, error } = await supabase
      .from('cache_invalidation_queue')
      .select('status');

    if (error) {
      console.error('Error fetching queue status:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
    }

    const status = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: data?.length || 0
    };

    data?.forEach(item => {
      if (item.status in status) {
        status[item.status as keyof typeof status]++;
      }
    });

    return status;
  } catch (error) {
    console.error('Error in getCacheQueueStatus:', error);
    return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
  }
}

/**
 * Clears completed and failed items from the queue
 */
export async function clearCompletedQueueItems(): Promise<{ success: boolean; deleted?: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cache_invalidation_queue')
      .delete()
      .in('status', ['completed', 'failed'])
      .select();

    if (error) {
      console.error('Error clearing queue items:', error);
      return { success: false, error: error.message };
    }

    console.log(`Cleared ${data?.length || 0} completed/failed queue items`);
    return { success: true, deleted: data?.length || 0 };
  } catch (error) {
    console.error('Error in clearCompletedQueueItems:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
