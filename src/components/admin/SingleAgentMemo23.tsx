import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const SingleAgentMemo23 = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fetchAdamData = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      toast.info('Fetching Adam Hamblen memo23 data...');
      
      const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
        body: { professionalId: '4bf24984-40fe-4077-92c7-316ac57989d4' }
      });

      if (error) throw error;

      setResult(data);
      toast.success('Successfully fetched memo23 data for Adam Hamblen');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-6 border rounded-lg">
      <h3 className="text-lg font-semibold">Fetch Adam Hamblen Memo23 Data</h3>
      
      <Button 
        onClick={fetchAdamData} 
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Fetching from memo23...
          </>
        ) : (
          'Fetch Adam\'s Data'
        )}
      </Button>

      {result && (
        <div className="space-y-2">
          <h4 className="font-semibold">Result:</h4>
          <div className="bg-muted p-4 rounded-lg">
            <p><strong>Professional:</strong> {result.professional}</p>
            <p><strong>Sidebar Video URL:</strong> {result.sidebarVideoUrl || 'Not found'}</p>
            <p><strong>Updated Fields:</strong> {result.updatedFields?.join(', ')}</p>
          </div>
          
          {result.sidebarVideoUrl && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Video Preview:</h4>
              <iframe
                width="320"
                height="180"
                src={`https://www.youtube.com/embed/${result.sidebarVideoUrl.split('v=')[1]?.split('&')[0] || result.sidebarVideoUrl.split('/').pop()?.split('?')[0]}`}
                title="Agent video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-lg border-2"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};