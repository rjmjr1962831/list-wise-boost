import { supabase } from "@/integrations/supabase/client";

export interface AutoImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  licensesFound: number;
}

function isTransientError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  
  // Retry on rate limits, timeouts, and network errors
  const retryablePatterns = [
    'timeout',
    'network',
    'rate limit',
    'server error',
    'internal error',
    '429',
    '500',
    '502',
    '503',
    '504'
  ];
  
  return retryablePatterns.some(pattern => message.includes(pattern));
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

    // Retry the edge function call with exponential backoff
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Fetching agents from Zillow bulk scraper (attempt ${attempt + 1})...`);
        
        const { data: zillowData, error: zillowError } = await supabase.functions.invoke('fetch-zillow-agents-bulk', {
          body: { 
            city: cityName, 
            state: state,
            categoryId: categoryId,
            cityId: cityId
          }
        });

        if (zillowError) {
          throw new Error(`Zillow API error: ${zillowError.message}`);
        }

        if (!zillowData || !zillowData.success) {
          throw new Error(zillowData?.error || 'Import failed');
        }

        // Success!
        const summary = zillowData.summary;
        result.success = true;
        result.imported = summary.created + summary.updated;
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        const shouldRetry = attempt < maxRetries && isTransientError(error);
        
        if (!shouldRetry) {
          throw error;
        }
        
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`Import attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
    
  } catch (error) {
    console.error('Error in autoImportZillowAgents:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error occurred');
    return result;
  }
}
