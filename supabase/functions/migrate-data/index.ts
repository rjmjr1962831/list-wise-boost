import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: migrationData } = await req.json();

    console.log('Starting data migration...');

    // Import cities
    const cityMap = new Map();
    for (const city of migrationData.cities) {
      const { data, error } = await supabase
        .from('cities')
        .upsert({
          name: city.name,
          state: city.state,
          state_slug: city.stateSlug,
          slug: city.slug,
          active: true,
        } as any)
        .select()
        .single();
      
      if (error) {
        console.error('City error:', error);
        throw error;
      }
      
      cityMap.set(`${city.stateSlug}/${city.slug}`, data.id);
      console.log(`Migrated city: ${city.name}`);
    }

    // Import categories
    const categoryMap = new Map();
    for (const category of migrationData.categories) {
      const { data, error } = await supabase
        .from('categories')
        .upsert({
          name: category.name,
          slug: category.slug,
          icon: category.icon || null,
          plural_name: category.pluralName,
          active: true,
        } as any)
        .select()
        .single();
      
      if (error) {
        console.error('Category error:', error);
        throw error;
      }
      
      categoryMap.set(category.slug, data.id);
      console.log(`Migrated category: ${category.name}`);
    }

    // Import professionals
    let professionalCount = 0;
    for (const prof of migrationData.professionals) {
      const cityId = cityMap.get(prof.cityKey);
      const categoryId = categoryMap.get(prof.categorySlug);

      if (!cityId || !categoryId) {
        console.warn(`Skipping professional ${prof.name}: missing city or category`);
        continue;
      }

      const { error } = await supabase
        .from('professionals')
        .insert({
          city_id: cityId,
          category_id: categoryId,
          name: prof.name,
          title: prof.title || null,
          image_url: prof.image || null,
          years_experience: prof.yearsExperience || null,
          specialty: prof.specialty || [],
          phone: prof.phone || null,
          email: prof.email || null,
          website: prof.website || null,
          description: prof.description || null,
          badges: prof.badges || [],
          rank: prof.rank,
          type: prof.type,
          active: true,
        });
      
      if (error) {
        console.error('Professional error:', error);
        throw error;
      }
      
      professionalCount++;
    }

    console.log(`Migration complete: ${professionalCount} professionals`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migrated ${cityMap.size} cities, ${categoryMap.size} categories, and ${professionalCount} professionals`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Migration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});