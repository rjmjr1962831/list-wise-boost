import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StopCircle } from "lucide-react";

export const StopEnrichmentButton = () => {
  const [isStopping, setIsStopping] = useState(false);

  const stopAllJobs = async () => {
    setIsStopping(true);
    try {
      // Update all running/pending jobs to cancelled
      const { error } = await supabase
        .from('enrichment_queue')
        .update({ 
          status: 'cancelled',
          paused_at: new Date().toISOString(),
          error_message: 'Manually stopped by admin'
        })
        .in('status', ['running', 'pending', 'processing']);

      if (error) throw error;

      toast.success("All enrichment jobs stopped");
    } catch (error: any) {
      console.error('Error stopping jobs:', error);
      toast.error(`Failed to stop jobs: ${error.message}`);
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <Button 
      onClick={stopAllJobs} 
      disabled={isStopping}
      variant="destructive"
      className="w-full"
    >
      <StopCircle className="mr-2 h-4 w-4" />
      {isStopping ? "Stopping..." : "Stop All Enrichment Jobs"}
    </Button>
  );
};
