import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function BeauvaisScottsdaleSetup() {
  const [isAdding, setIsAdding] = useState(false);

  const addBeauvaisToScottsdale = async () => {
    setIsAdding(true);
    try {
      // Get Scottsdale city ID
      const { data: scottsdale, error: cityError } = await supabase
        .from('cities')
        .select('id')
        .eq('slug', 'scottsdale')
        .single();

      if (cityError) throw cityError;
      if (!scottsdale) {
        toast.error("Scottsdale city not found");
        return;
      }

      // Get Real Estate category ID
      const { data: category, error: catError } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'top10realestateagents')
        .single();

      if (catError) throw catError;
      if (!category) {
        toast.error("Real estate category not found");
        return;
      }

      // Check if Beauvais already exists
      const { data: existing } = await supabase
        .from('professionals')
        .select('id, rank')
        .eq('zillow_profile_url', 'https://www.zillow.com/profile/Beauvais-Real-Estate')
        .eq('city_id', scottsdale.id)
        .single();

      if (existing) {
        // Update rank to 1 if needed
        if (existing.rank !== 1) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({ rank: 1 })
            .eq('id', existing.id);

          if (updateError) throw updateError;
          toast.success("Beauvais Real Estate updated to rank #1 in Scottsdale");
        } else {
          toast.info("Beauvais Real Estate already exists as rank #1 in Scottsdale");
        }
        return;
      }

      // Create new professional
      const { error: insertError } = await supabase
        .from('professionals')
        .insert({
          name: 'Beauvais Real Estate',
          city_id: scottsdale.id,
          category_id: category.id,
          rank: 1,
          type: 'established',
          active: true,
          zillow_profile_url: 'https://www.zillow.com/profile/Beauvais-Real-Estate',
          website: 'https://beauvaisrealestate.com',
        });

      if (insertError) throw insertError;

      toast.success("✅ Beauvais Real Estate added to Scottsdale as rank #1");
    } catch (error: any) {
      console.error('Error adding Beauvais:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beauvais Real Estate - Scottsdale</CardTitle>
        <CardDescription>
          Ensure Beauvais Real Estate is listed as rank #1 in Scottsdale
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={addBeauvaisToScottsdale}
          disabled={isAdding}
        >
          {isAdding ? "Adding..." : "Add/Update Beauvais Real Estate"}
        </Button>
      </CardContent>
    </Card>
  );
}
