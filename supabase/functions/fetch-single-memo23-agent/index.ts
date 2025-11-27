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
    const { professionalId } = await req.json();

    if (!professionalId) {
      throw new Error('professionalId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get professional record
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', professionalId)
      .single();

    if (profError || !professional) {
      throw new Error(`Professional not found: ${profError?.message}`);
    }

    if (!professional.zillow_profile_url) {
      throw new Error('No Zillow profile URL found for this professional');
    }

    console.log(`Fetching memo23 data for: ${professional.name} - ${professional.zillow_profile_url}`);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    const rotatingProxyUser = Deno.env.get('ROTATING_PROXY_USERNAME');
    const rotatingProxyPass = Deno.env.get('ROTATING_PROXY_PASSWORD');
    
    // Build rotating proxy URL with authentication
    const proxyUrl = (rotatingProxyUser && rotatingProxyPass)
      ? `http://${rotatingProxyUser}:${rotatingProxyPass}@rp.scrapegw.com:6060`
      : null;
    
    if (proxyUrl) {
      console.log('Using rotating proxy service at rp.scrapegw.com');
    } else {
      console.warn('Rotating proxy credentials not configured, using Apify proxy');
    }

    const actorId = 'memo23~apify-zillow-agents-cheerio';
    const actorInput = {
      startUrls: [{ url: professional.zillow_profile_url }],
      maxConcurrency: 1, // Reduce concurrency to avoid rate limits
      maxRequestRetries: 5,
      requestHandlerTimeoutSecs: 180,
      proxyConfiguration: proxyUrl ? { 
        useApifyProxy: false,
        proxyUrls: [proxyUrl]
      } : {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
        apifyProxyCountry: 'US'
      }
    };
    
    console.log('Actor input:', JSON.stringify(actorInput, null, 2));

    // Start the run with detailed logging
    console.log(`🚀 Starting Apify actor run for ${professional.name}...`);
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput)
      }
    );

    console.log(`📡 Apify API Response Status: ${runResponse.status} ${runResponse.statusText}`);
    
    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error(`❌ Failed to start Apify run - Status ${runResponse.status}:`, errorText);
      
      if (runResponse.status === 403) {
        console.error('🚫 403 FORBIDDEN from Apify API - Check API token or account limits');
      } else if (runResponse.status === 429) {
        console.error('⏱️ 429 RATE LIMIT from Apify API - Too many requests');
      }
      
      throw new Error(`Failed to start Apify run: ${runResponse.status} ${errorText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`✅ Apify run started successfully - Run ID: ${runId}`);
    
    // Poll for completion with exponential backoff
    let attempts = 0;
    const maxAttempts = 150; // 150 attempts with exponential backoff = up to 10 minutes
    let runStatus = 'RUNNING';
    let agentData = null;
    let http403Count = 0;
    let http429Count = 0;

    console.log(`⏳ Starting to poll Apify run ${runId} with exponential backoff...`);

    while (attempts < maxAttempts && runStatus === 'RUNNING') {
      // Exponential backoff: start at 2s, increase by 1.5x each time, cap at 30s
      const baseDelay = 2000;
      const backoffMultiplier = Math.min(Math.pow(1.5, Math.floor(attempts / 10)), 15);
      const delay = Math.min(baseDelay * backoffMultiplier, 30000);
      
      console.log(`⏱️ Waiting ${(delay / 1000).toFixed(1)}s before next poll (backoff multiplier: ${backoffMultiplier.toFixed(2)}x)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apifyToken}`
      );
      
      console.log(`📊 Poll attempt ${attempts + 1}/${maxAttempts} - API Status: ${statusResponse.status}`);
      
      if (statusResponse.status === 403) {
        http403Count++;
        console.error(`🚫 403 FORBIDDEN on status check (count: ${http403Count}) - Apify API may be blocking`);
      } else if (statusResponse.status === 429) {
        http429Count++;
        console.error(`⏱️ 429 RATE LIMIT on status check (count: ${http429Count}) - Slowing down...`);
        // Add extra delay on rate limit
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        runStatus = statusData.data.status;
        const stats = statusData.data.stats || {};
        
        console.log(`📈 Attempt ${attempts + 1}/${maxAttempts}: Status = ${runStatus}`);
        console.log(`   Stats - Requests: ${stats.requestsFinished || 0}/${stats.requestsTotal || 0}, Failed: ${stats.requestsFailed || 0}, Retries: ${stats.requestsRetries || 0}`);
        
        // Log if actor is experiencing errors
        if (stats.requestsFailed > 0) {
          console.warn(`⚠️ Actor has ${stats.requestsFailed} failed requests - may indicate blocking`);
        }
        
        if (runStatus === 'SUCCEEDED') {
          const datasetId = statusData.data.defaultDatasetId;
          console.log(`✅ Run succeeded! Fetching dataset ${datasetId}...`);
          console.log(`📊 Final stats - Duration: ${stats.computeUnits || 0} compute units, Cost: $${((stats.computeUnits || 0) * 0.0004).toFixed(4)}`);
          
          const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
          );
          
          console.log(`📦 Dataset fetch status: ${datasetResponse.status}`);
          
          if (datasetResponse.status === 403) {
            console.error('🚫 403 FORBIDDEN on dataset fetch - Apify API blocking dataset access');
            http403Count++;
          }
          
          if (datasetResponse.ok) {
            const results = await datasetResponse.json();
            console.log(`✅ Dataset returned ${results?.length || 0} items`);
            
            if (results && results.length > 0) {
              agentData = results[0];
              console.log(`✅ Successfully fetched memo23 data for ${professional.name}`);
              console.log(`   Data includes: ${Object.keys(agentData).slice(0, 10).join(', ')}...`);
            } else {
              console.error('❌ Dataset is empty - no agent data returned (possible scraping failure)');
            }
          } else {
            const errorText = await datasetResponse.text();
            console.error(`❌ Failed to fetch dataset: ${datasetResponse.status} - ${errorText}`);
          }
          break;
        } else if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
          console.error(`❌ Run ${runStatus}:`);
          console.error(`   Error: ${statusData.data.stats?.errors || 'No error details'}`);
          console.error(`   Exit code: ${statusData.data.exitCode || 'N/A'}`);
          console.error(`   Full data: ${JSON.stringify(statusData.data, null, 2)}`);
          
          // Log if this was due to 403s
          if (http403Count > 0) {
            console.error(`🚫 Run failed after encountering ${http403Count} 403 errors`);
          }
          
          throw new Error(`Apify run ${runStatus}: ${statusData.data.stats?.errors || 'Unknown error'}`);
        }
      } else {
        const errorText = await statusResponse.text();
        console.error(`❌ Failed to check run status: ${statusResponse.status} - ${errorText}`);
      }
      attempts++;
    }
    
    // Log final 403/429 counts
    if (http403Count > 0 || http429Count > 0) {
      console.error(`🚨 HTTP Error Summary: ${http403Count} 403s, ${http429Count} 429s encountered during polling`);
    }

    if (runStatus === 'RUNNING') {
      console.error(`⏰ Run timed out after ${maxAttempts} polling attempts`);
      console.error(`   Final HTTP error counts: ${http403Count} 403s, ${http429Count} 429s`);
      throw new Error(`Apify run timed out after ${maxAttempts} attempts (${http403Count} 403s, ${http429Count} 429s)`);
    }

    if (!agentData) {
      console.warn('No memo23 data returned; falling back to existing professional bio');

      // Normalize existing DB bio (which may be JSON or HTML) into plain text
      const rawDesc = (professional as any).description || (professional as any).get_to_know_me || '';
      let plainText = '';

      try {
        if (typeof rawDesc === 'string') {
          const trimmed = rawDesc.trim();
          const looksLikeJson = trimmed.startsWith('{') && trimmed.endsWith('}');

          if (looksLikeJson) {
            const parsed = JSON.parse(trimmed);
            const html = (parsed as any).description || trimmed;
            plainText = html
              .replace(/<[^>]*>/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, ' ')
              .trim();
          } else {
            plainText = trimmed;
          }
        } else if (rawDesc && typeof rawDesc === 'object') {
          const html = (rawDesc as any).description || JSON.stringify(rawDesc);
          plainText = html
            .replace(/<[^>]*>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
        }
      } catch {
        plainText = typeof rawDesc === 'string' ? rawDesc : '';
      }

      agentData = {
        getToKnowMe: plainText,
      };
    }

    // Map memo23 fields to database columns
    const updateData: any = {
      zillow_data_fetched_at: new Date().toISOString(),
    };
    
    if (agentData.name) updateData.name = agentData.name;
    if (agentData.screenName) updateData.screen_name = agentData.screenName;
    if (agentData.encodedZuid) {
      updateData.encoded_zuid = agentData.encodedZuid;
      updateData.zuid = agentData.encodedZuid;
    }
    // Extract video URL from multiple possible locations
    if (agentData.sidebarVideoUrl) {
      updateData.sidebar_video_url = agentData.sidebarVideoUrl;
    } else if (agentData.getToKnowMe) {
      // Try to extract video URL from getToKnowMe JSON structure
      try {
        let videoUrl = null;
        if (typeof agentData.getToKnowMe === 'string') {
          const parsed = JSON.parse(agentData.getToKnowMe);
          videoUrl = parsed.videoUrl;
        } else if (agentData.getToKnowMe.videoUrl) {
          videoUrl = agentData.getToKnowMe.videoUrl;
        }
        
        if (videoUrl) {
          updateData.sidebar_video_url = videoUrl;
          console.log(`Extracted video URL from getToKnowMe: ${videoUrl}`);
        }
      } catch (e) {
        console.log('Could not extract video from getToKnowMe:', e);
      }
    }
    
    // If still no video, try professionalInformation
    if (!updateData.sidebar_video_url && agentData.professionalInformation) {
      const videoInfo = agentData.professionalInformation.find((info: any) => 
        info.term === 'Websites' && info.links
      );
      if (videoInfo?.links) {
        const videoLink = videoInfo.links.find((link: any) => 
          link.url && (link.url.includes('youtube') || link.url.includes('vimeo'))
        );
        if (videoLink?.url) {
          updateData.sidebar_video_url = videoLink.url;
          console.log(`Extracted video URL from professionalInformation: ${videoLink.url}`);
        }
      }
    }
    if (agentData.businessAddress) {
      updateData.business_address = agentData.businessAddress;
      if (agentData.businessAddress.postalCode) {
        updateData.zip_code = agentData.businessAddress.postalCode;
      }
      const addrParts = [
        agentData.businessAddress.address1,
        agentData.businessAddress.city,
        agentData.businessAddress.state,
        agentData.businessAddress.postalCode
      ].filter(Boolean);
      if (addrParts.length > 0) {
        updateData.address = addrParts.join(', ');
      }
    }
    if (agentData.businessName) {
      updateData.business_name = agentData.businessName;
      updateData.company = agentData.businessName;
    }
    if (agentData.profilePhotoSrc) updateData.image_url = agentData.profilePhotoSrc;
    if (agentData.ratings) {
      // Store the full ratings object for reference
      updateData.ratings = agentData.ratings;
      // IMPORTANT: Preserve original rating/review count from getdataforme
      // Only set these if they don't already exist (i.e., agent wasn't imported from agenscrape)
      if (!professional.review_stars_rating && agentData.ratings.average !== undefined) {
        updateData.review_stars_rating = agentData.ratings.average;
        console.log(`Setting rating from memo23: ${agentData.ratings.average}`);
      } else {
        console.log(`Preserving existing rating: ${professional.review_stars_rating} (not overwriting with memo23 data)`);
      }
      if (!professional.num_total_reviews && agentData.ratings.count !== undefined) {
        updateData.num_total_reviews = agentData.ratings.count;
        console.log(`Setting review count from memo23: ${agentData.ratings.count}`);
      } else {
        console.log(`Preserving existing review count: ${professional.num_total_reviews} (not overwriting with memo23 data)`);
      }
    }
    if (agentData.phoneNumbers) {
      updateData.phone_numbers = agentData.phoneNumbers;
      if (agentData.phoneNumbers.cell) updateData.phone = agentData.phoneNumbers.cell;
    }
    if (agentData.agentLicenses) {
      updateData.agent_licenses = agentData.agentLicenses;
      if (agentData.agentLicenses.length > 0 && agentData.agentLicenses[0].text) {
        updateData.license_number = agentData.agentLicenses[0].text;
      }
    }

    // Verify Arizona license and calculate years_experience
    if (updateData.license_number) {
      console.log(`Checking license ${updateData.license_number} for verification...`);
      
      // Get city to check if it's Arizona
      const { data: cityData } = await supabase
        .from('cities')
        .select('state')
        .eq('id', professional.city_id)
        .single();

      if (cityData?.state === 'Arizona') {
        console.log('Arizona agent detected, verifying license against state database...');
        
        try {
          // Fetch the Arizona license CSV from Supabase Storage
          // The CSV file should be uploaded to the professional-photos bucket
          const csvUrl = `${supabaseUrl}/storage/v1/object/public/professional-photos/arizona-licenses.csv`;
          console.log(`Fetching Arizona licenses from Supabase Storage: ${csvUrl}`);
          
          const csvResponse = await fetch(csvUrl);
          
          if (csvResponse.ok) {
            const csvText = await csvResponse.text();
            
            // Debug: Show first few characters to check encoding
            console.log(`CSV starts with: ${csvText.substring(0, 100)}`);
            
            // Split lines and handle both Unix (\n) and Windows (\r\n) line endings
            const lines = csvText.split(/\r?\n/);
            console.log(`Total lines in CSV: ${lines.length}`);
            
            // Normalize license number for comparison (remove spaces, make uppercase)
            const normalizedLicense = updateData.license_number.replace(/\s/g, '').toUpperCase();
            console.log(`Searching for normalized license: ${normalizedLicense}`);
            
            // Helper function to parse CSV line properly handling empty fields
            const parseCSVLine = (line: string): string[] => {
              const fields: string[] = [];
              let currentField = '';
              let inQuotes = false;
              
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  fields.push(currentField.trim());
                  currentField = '';
                } else {
                  currentField += char;
                }
              }
              fields.push(currentField.trim());
              return fields;
            };
            
            // Search for license in CSV (skip header row)
            let foundRecord = null;
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              
              // Parse CSV line properly handling empty fields
              const fields = parseCSVLine(line);
              
              // Debug first parsed line to verify field indices
              if (i === 1) {
                console.log(`Sample parsed line: [${fields.map((f, idx) => `${idx}:"${f}"`).join(', ')}]`);
              }
              
              // CSV format: LastName,FirstName,MiddleName,OriginalDate,LicNumber,LicType,EmployerLegalName
              if (fields.length < 5) continue; // Need at least 5 fields to get license number
              
              const recordLicense = fields[4]?.trim().replace(/\s/g, '').toUpperCase();
              
              if (recordLicense === normalizedLicense) {
                foundRecord = {
                  lastName: fields[0] || '',
                  firstName: fields[1] || '',
                  middleName: fields[2] || '',
                  originalDate: fields[3] || '',
                  licNumber: fields[4] || '',
                  licType: fields[5] || '',
                  employerLegalName: fields[6] || '',
                };
                console.log(`✅ License found in Arizona database!`, foundRecord);
                break;
              }
            }
            
            if (foundRecord) {
              // Calculate years_experience from OriginalDate
              const issueDate = new Date(foundRecord.originalDate);
              const currentDate = new Date();
              const yearsExperience = currentDate.getFullYear() - issueDate.getFullYear();
              
              console.log(`Calculated ${yearsExperience} years of experience from ${foundRecord.originalDate}`);
              
              // Update with verified data
              updateData.years_experience = yearsExperience;
              updateData.license_verified_at = new Date().toISOString();
              
              // Add "License Verified" badge if not already present
              const currentBadges = professional.badges || [];
              if (!currentBadges.includes('License Verified')) {
                updateData.badges = [...currentBadges, 'License Verified'];
                console.log('Added "License Verified" badge');
              }
            } else {
              console.log('License not found in Arizona database');
            }
          } else {
            console.warn(`Failed to fetch Arizona license CSV from all URLs`);
          }
        } catch (licenseError) {
          console.error('Error verifying Arizona license:', licenseError);
          // Don't fail the whole process if license verification fails
        }
      } else {
        console.log(`Agent is not in Arizona (state: ${cityData?.state}), skipping license verification`);
      }
    }
    if (agentData.agentSalesStats) {
      updateData.agent_sales_stats = agentData.agentSalesStats;
      if (agentData.agentSalesStats.countAllTime) {
        updateData.total_sales = agentData.agentSalesStats.countAllTime;
      }
    }
    if (agentData.professionalInformation) {
      // DO NOT store professional_information to avoid importing social media data
      // updateData.professional_information = agentData.professionalInformation;
      
      // Extract specialties from professionalInformation
      const specialtiesEntry = agentData.professionalInformation.find((info: any) => 
        info.term === 'Specialties' || info.term === 'Areas of Focus'
      );
      if (specialtiesEntry?.detail && Array.isArray(specialtiesEntry.detail)) {
        const specialties = specialtiesEntry.detail
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item.text) return item.text;
            return null;
          })
          .filter(Boolean);
        if (specialties.length > 0) {
          updateData.specialty = specialties;
          console.log(`Extracted ${specialties.length} specialties:`, specialties);
        }
      }
      
      // Extract email from professionalInformation with filtering for personal emails
      const genericPrefixes = ['info@', 'contact@', 'hello@', 'support@', 'sales@', 'admin@', 'office@', 'team@'];
      const isGenericEmail = (email: string) => {
        const lower = email.toLowerCase();
        return genericPrefixes.some(prefix => lower.startsWith(prefix));
      };

      const emailEntry = agentData.professionalInformation.find((info: any) => 
        info.term === 'Email' || info.term === 'Contact Email'
      );
      
      let extractedEmail = null;
      if (emailEntry?.detail) {
        const emailValue = Array.isArray(emailEntry.detail) ? emailEntry.detail[0] : emailEntry.detail;
        if (typeof emailValue === 'string' && emailValue.includes('@')) {
          extractedEmail = emailValue;
        } else if (emailValue?.text && emailValue.text.includes('@')) {
          extractedEmail = emailValue.text;
        }
        
        // Only use the email if it's not generic, or if we don't have any email yet
        if (extractedEmail && (!isGenericEmail(extractedEmail) || !updateData.email)) {
          updateData.email = extractedEmail;
          console.log(`Extracted email from professionalInformation: ${extractedEmail}${isGenericEmail(extractedEmail) ? ' (generic)' : ' (personal)'}`);
        }
      }
      
      // Extract website from professionalInformation
      const websitesEntry = agentData.professionalInformation.find((info: any) => 
        info.term === 'Websites' || info.term === 'Website'
      );
      if (websitesEntry?.links && Array.isArray(websitesEntry.links)) {
        const websiteLink = websitesEntry.links.find((link: any) => 
          link.url && !link.url.includes('youtube') && !link.url.includes('vimeo') && 
          !link.url.includes('facebook') && !link.url.includes('instagram') &&
          !link.url.includes('twitter') && !link.url.includes('linkedin')
        );
        if (websiteLink?.url) {
          updateData.website = websiteLink.url;
          console.log(`Extracted website from professionalInformation: ${websiteLink.url}`);
        }
      }
    }
    if (agentData.professionalData) {
      updateData.professional_data = agentData.professionalData;
    }
    
    // Extract years_experience from bio if not already set from license verification
    if (!updateData.years_experience && agentData.getToKnowMe) {
      console.log('Attempting to extract years_experience from bio...');
      
      const bioText = typeof agentData.getToKnowMe === 'string' 
        ? agentData.getToKnowMe 
        : JSON.stringify(agentData.getToKnowMe);
      
      // Pattern 1: Direct year mentions like "15 years of experience", "over 20 years"
      const directYearPatterns = [
        /(\d+)\+?\s+years?\s+(?:of\s+)?(?:experience|in\s+(?:the\s+)?(?:business|industry|real\s+estate))/i,
        /(?:over|more\s+than|nearly)\s+(\d+)\s+years?/i,
      ];
      
      const foundYears: number[] = [];
      
      for (const pattern of directYearPatterns) {
        const match = bioText.match(pattern);
        if (match && match[1]) {
          const years = parseInt(match[1], 10);
          if (years > 0 && years <= 70) { // Sanity check
            foundYears.push(years);
            console.log(`Found direct years mention: ${years} years`);
          }
        }
      }
      
      // Pattern 2: "Since YYYY" mentions
      const sinceYearPatterns = [
        /since\s+(\d{4})/i,
        /starting\s+in\s+(\d{4})/i,
        /began\s+in\s+(\d{4})/i,
        /started\s+in\s+(\d{4})/i,
      ];
      
      const currentYear = new Date().getFullYear();
      for (const pattern of sinceYearPatterns) {
        const match = bioText.match(pattern);
        if (match && match[1]) {
          const year = parseInt(match[1], 10);
          if (year >= 1950 && year <= currentYear) {
            const calculatedYears = currentYear - year;
            foundYears.push(calculatedYears);
            console.log(`Found "since ${year}" mention, calculated: ${calculatedYears} years`);
          }
        }
      }
      
      // Use the highest value found (most conservative estimate)
      if (foundYears.length > 0) {
        const extractedYears = Math.max(...foundYears);
        updateData.years_experience = extractedYears;
        console.log(`✅ Extracted ${extractedYears} years of experience from bio`);
        
        // Update the DB with extracted years
        const { error: yearsUpdateError } = await supabase
          .from('professionals')
          .update({ years_experience: extractedYears })
          .eq('id', professionalId);
          
        if (yearsUpdateError) {
          console.error('Failed to update years_experience:', yearsUpdateError);
        }
      } else {
        console.log('No years_experience pattern found in bio');
      }
    }
    
    // Rewrite bio if present to make it unique
    if (agentData.getToKnowMe) {
      try {
        console.log('Rewriting bio to make it unique...');

        // Normalize to a plain string we know is safe to send
        const sourceBio: any = agentData.getToKnowMe;
        let originalBio = '';

        if (typeof sourceBio === 'string') {
          originalBio = sourceBio.trim();

          // Try to detect and unwrap JSON-wrapped HTML description
          try {
            const maybeJson = JSON.parse(originalBio);
            if (maybeJson && typeof maybeJson === 'object' && maybeJson.description) {
              const htmlContent = maybeJson.description as string;
              originalBio = htmlContent
                .replace(/<[^>]*>/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();
            }
          } catch {
            // Not JSON, keep as trimmed plain text
          }
        } else if (sourceBio && typeof sourceBio === 'object' && (sourceBio as any).description) {
          const htmlContent = (sourceBio as any).description as string;
          originalBio = htmlContent
            .replace(/<[^>]*>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
        }

        if (!originalBio) {
          console.warn('No usable bio text found; skipping rewrite-bio call');
          // Still persist whatever we have locally as a best-effort plain text bio
          const fallbackBio = typeof sourceBio === 'string' ? sourceBio : JSON.stringify(sourceBio ?? '');
          updateData.get_to_know_me = fallbackBio;
          updateData.description = fallbackBio;
        } else {
          console.log('Sending bio to rewrite-bio function, length:', originalBio.length);

          const rewriteResponse = await fetch(`${supabaseUrl}/functions/v1/rewrite-bio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ originalBio }),
          });

          let rewrittenBio: string | null = null;

          if (rewriteResponse.ok) {
            const rewriteData = await rewriteResponse.json();
            if (rewriteData?.rewrittenBio && typeof rewriteData.rewrittenBio === 'string') {
              console.log('Bio rewritten successfully');
              rewrittenBio = rewriteData.rewrittenBio;
            }
          } else {
            console.error('Bio rewrite HTTP error:', rewriteResponse.status, await rewriteResponse.text());
          }

          const finalBio = rewrittenBio || originalBio;
          updateData.get_to_know_me = finalBio;
          updateData.description = finalBio;
        }
      } catch (rewriteError) {
        console.error('Bio rewrite exception:', rewriteError);
        // Fallback to original value without remote rewriting
        const fallbackBio = typeof agentData.getToKnowMe === 'string'
          ? agentData.getToKnowMe
          : JSON.stringify(agentData.getToKnowMe ?? '');
        updateData.get_to_know_me = fallbackBio;
        updateData.description = fallbackBio;
      }
    }
    if (agentData.emailAddress) updateData.email = agentData.emailAddress;
    if (agentData.numTotalReviews) updateData.num_total_reviews = agentData.numTotalReviews;

    // Update the professional record
    const { error: updateError } = await supabase
      .from('professionals')
      .update(updateData)
      .eq('id', professionalId);

    if (updateError) {
      throw new Error(`Failed to update professional: ${updateError.message}`);
    }

    console.log(`✅ Updated professional ${professional.name} with memo23 data`);
    console.log(`   Updated ${Object.keys(updateData).length} fields`);

    // Log proxy metrics for health monitoring
    try {
      const proxyProvider = proxyUrl ? 'proxyscrape_residential' : 'apify_residential';
      const isSuccess = http403Count === 0 && agentData !== null;
      
      // Fetch existing metrics
      const { data: existingMetric } = await supabase
        .from('marketing_content')
        .select('*')
        .eq('page', 'admin')
        .eq('section', 'proxy_metrics')
        .eq('key', proxyProvider)
        .maybeSingle();

      const existingData = existingMetric ? JSON.parse(existingMetric.value) : {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        error403Count: 0,
        error429Count: 0
      };

      const updatedData = {
        totalRequests: existingData.totalRequests + 1,
        successfulRequests: existingData.successfulRequests + (isSuccess ? 1 : 0),
        failedRequests: existingData.failedRequests + (isSuccess ? 0 : 1),
        error403Count: existingData.error403Count + http403Count,
        error429Count: existingData.error429Count + http429Count
      };

      if (existingMetric) {
        await supabase
          .from('marketing_content')
          .update({ value: JSON.stringify(updatedData) })
          .eq('id', existingMetric.id);
      } else {
        await supabase
          .from('marketing_content')
          .insert({
            page: 'admin',
            section: 'proxy_metrics',
            key: proxyProvider,
            type: 'json',
            value: JSON.stringify(updatedData)
          });
      }

      console.log(`📊 Updated proxy metrics for ${proxyProvider}`);
    } catch (metricsError) {
      console.error('Failed to update proxy metrics:', metricsError);
      // Don't fail the request if metrics update fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        professional: professional.name,
        sidebarVideoUrl: updateData.sidebar_video_url || null,
        phoneNumbers: updateData.phone_numbers ? Object.values(updateData.phone_numbers).filter(Boolean) : [],
        email: updateData.email || null,
        reviewsCount: updateData.num_total_reviews || 0,
        updatedFields: Object.keys(updateData),
        http403Count: http403Count || 0,
        http429Count: http429Count || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ FATAL ERROR:', error.message);
    console.error('   Stack:', error.stack);
    
    // Check if error message indicates 403
    const is403Error = error.message?.includes('403') || error.message?.includes('FORBIDDEN');
    const is429Error = error.message?.includes('429') || error.message?.includes('rate limit');
    
    if (is403Error) {
      console.error('🚫 403 FORBIDDEN ERROR - Proxy may be blocked by Zillow or Apify API issue');
    } else if (is429Error) {
      console.error('⏱️ 429 RATE LIMIT ERROR - Need to slow down requests');
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        errorType: is403Error ? '403_FORBIDDEN' : is429Error ? '429_RATE_LIMIT' : 'UNKNOWN',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});