import { supabase } from "@/integrations/supabase/client";

export interface AutoImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  licensesFound: number;
}

export async function autoImportZillowAgents(
  cityId: string,
  cityName: string,
  state: string
): Promise<AutoImportResult> {
  const result: AutoImportResult = {
    success: false,
    imported: 0,
    errors: [],
    licensesFound: 0
  };

  try {
    // Get the Real Estate Agent category ID
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (categoryError || !categoryData) {
      result.errors.push('Could not find Real Estate Agent category');
      return result;
    }

    const categoryId = categoryData.id;

    // Fetch agents from Zillow using the bulk comprehensive scraper
    // The edge function now handles the DB insert automatically
    console.log('Fetching agents from Zillow bulk scraper...');
    const { data: zillowData, error: zillowError } = await supabase.functions.invoke('fetch-zillow-agents-bulk', {
      body: { 
        city: cityName, 
        state: state,
        categoryId: categoryId,
        cityId: cityId
      }
    });

    if (zillowError) {
      result.errors.push(`Zillow API error: ${zillowError.message}`);
      return result;
    }

    // Edge function now returns a summary object, not raw agents
    if (!zillowData || !zillowData.success) {
      result.errors.push(zillowData?.error || 'Import failed');
      return result;
    }

    const summary = zillowData.summary;
    result.success = true;
    result.imported = summary.created + summary.updated;
    
    return result;
  } catch (error) {
    console.error('Error in autoImportZillowAgents:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error occurred');
    return result;
  }
}
