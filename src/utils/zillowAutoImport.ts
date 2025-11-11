import { supabase } from "@/integrations/supabase/client";
import placeholderAgent from "@/assets/placeholder-agent.jpg";

export interface AutoImportResult {
  success: boolean;
  imported: number;
  errors: string[];
}

export async function autoImportZillowAgents(
  cityId: string,
  cityName: string,
  state: string
): Promise<AutoImportResult> {
  const result: AutoImportResult = {
    success: false,
    imported: 0,
    errors: []
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

    // Fetch agents from Zillow
    const { data: zillowData, error: zillowError } = await supabase.functions.invoke('fetch-zillow-agents', {
      body: { city: cityName, state: state }
    });

    if (zillowError) {
      result.errors.push(`Zillow API error: ${zillowError.message}`);
      return result;
    }

    const agentList = Array.isArray(zillowData) ? zillowData : [];
    
    if (agentList.length === 0) {
      result.errors.push('No agents found from Zillow');
      return result;
    }

    // Import up to 10 agents
    const agentsToImport = agentList.slice(0, 10);

    for (let i = 0; i < agentsToImport.length; i++) {
      const agent = agentsToImport[i];
      
      try {
        // Get agent photo or use placeholder
        let imageUrl = agent.profilePhotoSrc || null;
        
        // If no photo from Zillow, upload placeholder to storage
        if (!imageUrl) {
          try {
            const response = await fetch(placeholderAgent);
            const blob = await response.blob();
            const fileName = `placeholder-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('professional-photos')
              .upload(fileName, blob, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
              });

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('professional-photos')
                .getPublicUrl(fileName);
              imageUrl = publicUrl;
            }
          } catch (uploadErr) {
            console.error('Error uploading placeholder:', uploadErr);
          }
        }

        // Build website URL - handle both relative and absolute URLs
        let websiteUrl = null;
        if (agent.profileLink) {
          websiteUrl = agent.profileLink.startsWith('http') 
            ? agent.profileLink 
            : `https://www.zillow.com${agent.profileLink}`;
        }

        // Map Zillow data to professional structure
        const professionalData = {
          name: agent.fullName || "Unknown Agent",
          company: agent.businessName || null,
          phone: agent.phoneNumber || null,
          email: null,
          website: websiteUrl,
          image_url: imageUrl,
          specialty: [],
          years_experience: null,
          license_number: null,
          description: agent.reviewExcerpt || null,
          city_id: cityId,
          category_id: categoryId,
          type: i < 5 ? 'established' : 'emerging', // First 5 as established, rest as emerging
          rank: i + 1,
          active: true,
        };

        const { error: insertError } = await supabase
          .from('professionals')
          .insert([professionalData]);

        if (insertError) {
          result.errors.push(`Failed to import ${professionalData.name}: ${insertError.message}`);
        } else {
          result.imported++;
        }
      } catch (importError: any) {
        result.errors.push(`Error importing agent ${i + 1}: ${importError.message}`);
      }
    }

    result.success = result.imported > 0;
    return result;

  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`);
    return result;
  }
}
