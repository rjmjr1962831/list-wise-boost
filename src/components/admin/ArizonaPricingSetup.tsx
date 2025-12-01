import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ArizonaPricingSetup() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-arizona-pricing', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Populated ${data.cities} Arizona cities with pricing`
      });
    } catch (err: any) {
      console.error('Setup error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to setup pricing',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPolicies = () => {
    toast({
      title: 'Manual Step Required',
      description: 'Open Backend → Database → RLS Policies and add policies for arizona_city_pricing and agent_city_subscriptions tables'
    });
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Arizona City Pricing Setup</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Populate 27 Arizona cities with tiered pricing (Platinum, Gold, Silver, Bronze)
      </p>
      
      <div className="space-y-2">
        <Button
          onClick={handleSetup}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Populating Data...
            </>
          ) : (
            'Populate Pricing Data'
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleAddPolicies}
          className="w-full"
        >
          Add RLS Policies (Manual)
        </Button>
      </div>

      <div className="mt-4 p-4 bg-muted rounded-md text-xs">
        <strong>RLS Policies to Add:</strong>
        <pre className="mt-2 whitespace-pre-wrap">
{`CREATE POLICY "Anyone can view city pricing"
  ON arizona_city_pricing
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view subscriptions"
  ON agent_city_subscriptions
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage subscriptions"
  ON agent_city_subscriptions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));`}
        </pre>
      </div>
    </Card>
  );
}