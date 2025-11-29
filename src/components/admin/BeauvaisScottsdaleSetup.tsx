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
        // Update rank to 1 and mark as brand builder
        const { error: updateError } = await supabase
          .from('professionals')
          .update({ rank: 1, is_brand_builder: true })
          .eq('id', existing.id);

        if (updateError) throw updateError;

        // Ensure professional_cities record exists
        const { error: cityLinkError } = await supabase
          .from('professional_cities')
          .upsert({
            professional_id: existing.id,
            city_id: scottsdale.id,
            rank: 1,
            active: true
          }, { onConflict: 'professional_id,city_id' });

        if (cityLinkError) throw cityLinkError;

        toast.success("Beauvais Real Estate updated to rank #1 in Scottsdale");
        return;
      }

      // Create new professional
      const { data: newProfessional, error: insertError } = await supabase
        .from('professionals')
        .insert({
          name: 'Dina and Mark Beauvais',
          company: 'Beauvais Real Estate',
          city_id: scottsdale.id,
          category_id: category.id,
          rank: 1,
          type: 'established',
          active: true,
          is_brand_builder: true,
          zillow_profile_url: 'https://www.zillow.com/profile/Beauvais-Real-Estate',
          website: 'https://beauvaisrealestate.com',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Add to professional_cities table
      const { error: cityLinkError } = await supabase
        .from('professional_cities')
        .upsert({
          professional_id: newProfessional.id,
          city_id: scottsdale.id,
          rank: 1,
          active: true
        }, { onConflict: 'professional_id,city_id' });

      if (cityLinkError) throw cityLinkError;

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
        <CardTitle>Dina and Mark Beauvais - Scottsdale</CardTitle>
        <CardDescription>
          Ensure Dina and Mark Beauvais (Beauvais Real Estate) is listed as rank #1 in Scottsdale
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
