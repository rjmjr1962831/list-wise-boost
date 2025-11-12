import { supabase } from "@/integrations/supabase/client";
import placeholderAgent from "@/assets/placeholder-agent.jpg";
import { getLicenseLookupByStateAbbr } from "@/data/stateLicenseLookups";

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
          description: agent.description || agent.bio || agent.about || null,
          city_id: cityId,
          category_id: categoryId,
          type: i < 5 ? 'established' : 'emerging', // First 5 as established, rest as emerging
          rank: i + 1,
          active: true,
          zuid: agent.zuid || null,
        };

        const { data: insertedData, error: insertError } = await supabase
          .from('professionals')
          .insert([professionalData])
          .select()
          .single();

        if (insertError) {
          result.errors.push(`Failed to import ${professionalData.name}: ${insertError.message}`);
        } else {
          result.imported++;
          
          // Auto-lookup license number
          if (insertedData) {
            try {
              console.log(`Looking up license for ${professionalData.name}...`);
              const licenseLookupUrl = getLicenseLookupByStateAbbr(state);
              
              if (licenseLookupUrl) {
                const { data: licenseData, error: licenseError } = await supabase.functions.invoke('lookup-agent-license', {
                  body: {
                    agentName: professionalData.name,
                    state: state,
                    licensePortalUrl: licenseLookupUrl
                  }
                });
                
                if (!licenseError && licenseData?.licenseNumber) {
                  console.log(`License found for ${professionalData.name}: ${licenseData.licenseNumber}`);
                  
                  // Update the professional with the license number
                  const { error: updateError } = await supabase
                    .from('professionals')
                    .update({ license_number: licenseData.licenseNumber })
                    .eq('id', insertedData.id);
                  
                  if (!updateError) {
                    result.licensesFound++;
                  } else {
                    console.error(`Failed to update license for ${professionalData.name}:`, updateError);
                  }
                } else {
                  console.log(`No license found for ${professionalData.name}`);
                }
              }
              
              // Small delay to avoid overwhelming the license lookup API
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (licenseErr) {
              console.error(`Error looking up license for ${professionalData.name}:`, licenseErr);
              // Don't fail the import if license lookup fails
            }
          }
          
          // Auto-generate bio if missing
          if (!professionalData.description && insertedData) {
            try {
              console.log(`Generating bio for ${professionalData.name}...`);
              const { error: bioError } = await supabase.functions.invoke('generate-agent-bios', {
                body: {
                  professional_ids: [insertedData.id]
                }
              });
              
              if (bioError) {
                console.error(`Bio generation failed for ${professionalData.name}:`, bioError);
              } else {
                console.log(`Bio generated for ${professionalData.name}`);
              }
            } catch (bioErr) {
              console.error(`Error generating bio for ${professionalData.name}:`, bioErr);
            }
          }
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
