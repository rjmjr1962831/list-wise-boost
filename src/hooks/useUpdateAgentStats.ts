import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useUpdateAgentStats = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateAgentStats = async (
    professionalId: string, 
    city: string, 
    state: string
  ) => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-agent-zillow-stats', {
        body: { professionalId, city, state }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        toast.warning(data?.message || 'Could not find updated stats for this agent');
        return false;
      }

      toast.success(`Updated stats for ${data.agentName || 'agent'}`);
      return true;
    } catch (error) {
      console.error('Failed to update agent stats:', error);
      toast.error('Failed to update agent stats');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return { updateAgentStats, isUpdating };
};
