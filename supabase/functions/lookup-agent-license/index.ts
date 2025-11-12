import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LicenseLookupRequest {
  agentName: string;
  state: string;
  licensePortalUrl: string;
}

// Helper to extract individual names from team names
function extractIndividualNames(agentName: string): string[] {
  // Remove common team/group suffixes
  const cleanName = agentName
    .replace(/\s+(Group|Team|Associates?|Real Estate.*|Realty.*|Top.*Agents?)$/i, '')
    .trim();
  
  // Split on "and", "&" to get multiple people
  const names = cleanName.split(/\s+(?:and|\&)\s+/i);
  
  console.log(`Extracted names from "${agentName}":`, names);
  
  return names.map(name => name.trim()).filter(name => {
    // Filter out very short names or obvious non-person names
    const words = name.split(/\s+/);
    const isValid = words.length >= 2 && words.length <= 4 && !/Group|Team|Inc|LLC/i.test(name);
    console.log(`Name "${name}" valid: ${isValid}`);
    return isValid;
  });
}

// Use AI to intelligently parse any state license portal
async function lookupWithAI(agentName: string, portalUrl: string, state: string): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    return null;
  }

  try {
    // Fetch the license portal page
    console.log(`Fetching portal: ${portalUrl}`);
    const response = await fetch(portalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.error(`Portal fetch failed: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Use OpenAI to intelligently extract license information
    console.log(`Using AI to parse license for ${agentName}`);
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting real estate license numbers from state licensing board websites. 
Given an HTML page and an agent name, find and return ONLY the license number.
Return "NOT_FOUND" if you cannot find a license number for this person.
Only return the license number itself, nothing else - no explanations, no additional text.`
          },
          {
            role: 'user',
            content: `State: ${state}
Agent Name: ${agentName}
Portal URL: ${portalUrl}

HTML Content (first 8000 chars):
${html.substring(0, 8000)}

Find the license number for ${agentName}. Return ONLY the license number or "NOT_FOUND".`
          }
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      return null;
    }

    const aiData = await aiResponse.json();
    const licenseNumber = aiData.choices[0]?.message?.content?.trim();
    
    console.log(`AI response: ${licenseNumber}`);
    
    if (licenseNumber && licenseNumber !== 'NOT_FOUND' && licenseNumber !== 'null' && licenseNumber.length > 0) {
      return licenseNumber;
    }
    
    return null;
  } catch (error) {
    console.error('AI lookup error:', error);
    return null;
  }
}

// State-specific search implementations
async function searchArizona(agentName: string): Promise<string | null> {
  try {
    const [lastName, firstName] = agentName.split(' ').reverse();
    const searchUrl = `https://services.azre.gov/PdbWeb/IndividualLicense/SearchIndividualLicenses`;
    
    // Arizona requires a POST request with form data
    const formData = new URLSearchParams({
      'LastName': lastName || '',
      'FirstName': firstName || '',
      'LicenseNumber': '',
      'Status': 'Active'
    });

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formData.toString(),
    });

    if (!response.ok) return null;

    const html = await response.text();
    
    // Arizona license numbers are typically SA followed by numbers
    const licenseMatch = html.match(/SA\d{9}/i) || html.match(/License\s*Number[:\s]*([A-Z]{2}\d{9})/i);
    return licenseMatch ? licenseMatch[0] : null;
  } catch (error) {
    console.error('Arizona search error:', error);
    return null;
  }
}

async function searchCalifornia(agentName: string): Promise<string | null> {
  try {
    // Extract individual names if it's a team
    const individualNames = extractIndividualNames(agentName);
    console.log(`Searching CA for individuals: ${JSON.stringify(individualNames)}`);
    
    // Try each individual name with multiple strategies
    for (const name of individualNames) {
      const nameParts = name.split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      
      if (!firstName || !lastName) continue;
      
      const attempts = [
        { fn: firstName, ln: lastName },               // full first + last
        { fn: '', ln: lastName },                      // last name only
        { fn: firstName.charAt(0), ln: lastName },     // first initial + last
      ];

      for (const attempt of attempts) {
        const variants = [
          `${lastName}, ${attempt.fn || firstName}`,
          `${lastName}`,
        ].filter(Boolean);

        for (const q of variants) {
          console.log(`Trying CA POST search: "${q}"`);
          const form = new URLSearchParams({
            LICENSEE_NAME: q,
            CITY_STATE: '',
            LICENSE_ID: '',
          });
          const url = 'https://www2.dre.ca.gov/PublicASP/pplinfo.asp?start=1';
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://www2.dre.ca.gov/PublicASP/pplinfo.asp',
              'Accept': 'text/html,application/xhtml+xml',
            },
            body: form.toString(),
          });

          console.log(`Response status: ${response.status}`);
          if (!response.ok) {
            console.log(`Search failed with status ${response.status}`);
            continue;
          }

          const html = await response.text();
          console.log(`HTML length: ${html.length}`);
          
          // First, look for direct detail links (most reliable)
          const idLinkMatch = html.match(/pplinfo\d?\.asp\?License_id=(\d{6,8})/i) || html.match(/License_id\s*=\s*(\d{6,8})/i);
          if (idLinkMatch) {
            console.log(`Found CA license_id for ${name}: ${idLinkMatch[1]}`);
            return idLinkMatch[1];
          }

          // Fallback: attempt to parse visible license number patterns
          const licensePatterns = [
            /(CalDRE|DRE|BRE)\s*(?:Lic(?:ense)?|ID|#)?\s*:?\s*#?\s*0?(\d{7,8})/i,
            /License\s*(?:ID|Number|#)\s*:?\s*0?(\d{7,8})/i,
          ];
          for (const pattern of licensePatterns) {
            const match = html.match(pattern);
            if (match) {
              const id = match[2] || match[1];
              const normalized = (Array.isArray(id) ? id[0] : id).replace(/^0/, '');
              console.log(`Found CA license for ${name}: ${normalized}`);
              return normalized;
            }
          }
          console.log(`No license id or number found in POST search results for query "${q}"`);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('California search error:', error);
    return null;
  }
}

async function searchTexas(agentName: string): Promise<string | null> {
  try {
    const searchUrl = `https://www.trec.texas.gov/apps/license-holder-search/?name=${encodeURIComponent(agentName)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    
    // Texas license numbers are typically 6-7 digits
    const licenseMatch = html.match(/License\s*(?:Number|#)\s*:?\s*(\d{6,7})/i);
    return licenseMatch ? licenseMatch[1] : null;
  } catch (error) {
    console.error('Texas search error:', error);
    return null;
  }
}

async function searchFlorida(agentName: string): Promise<string | null> {
  try {
    const [lastName, firstName] = agentName.split(' ').reverse();
    const searchUrl = `https://www.myfloridalicense.com/wl11.asp?mode=0&SID=&brd=&typ=&lnm=${encodeURIComponent(lastName || '')}&fnm=${encodeURIComponent(firstName || '')}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    
    // Florida license numbers can vary - look for common patterns
    const licenseMatch = html.match(/License\s*(?:Number|#)\s*:?\s*([A-Z]{2}\d{7}|\d{7})/i);
    return licenseMatch ? licenseMatch[1] : null;
  } catch (error) {
    console.error('Florida search error:', error);
    return null;
  }
}

async function genericSearch(agentName: string, portalUrl: string): Promise<string | null> {
  try {
    // Try to construct a search URL with the agent name as a query parameter
    const nameParam = encodeURIComponent(agentName);
    const [lastName, firstName] = agentName.split(' ').reverse();
    
    // Try common search URL patterns
    const searchPatterns = [
      `${portalUrl}?name=${nameParam}`,
      `${portalUrl}?lastname=${encodeURIComponent(lastName || '')}&firstname=${encodeURIComponent(firstName || '')}`,
      `${portalUrl}/search?q=${nameParam}`,
    ];

    for (const searchUrl of searchPatterns) {
      try {
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!response.ok) continue;

        const html = await response.text();
        
        // Look for the agent name in the results
        const nameLower = agentName.toLowerCase();
        if (!html.toLowerCase().includes(nameLower)) continue;

        // Try to find license number near the name
        const nameIndex = html.toLowerCase().indexOf(nameLower);
        const context = html.substring(
          Math.max(0, nameIndex - 1000),
          Math.min(html.length, nameIndex + 1000)
        );

        // Try common license number patterns
        const patterns = [
          /License\s*(?:Number|#|No\.?)\s*:?\s*([A-Z]{1,3}\d{6,10})/i,
          /Lic\s*(?:Number|#|No\.?)\s*:?\s*([A-Z]{1,3}\d{6,10})/i,
          /\b([A-Z]{2}\d{7,10})\b/g,
          /\b(\d{7,10})\b/g,
        ];

        for (const pattern of patterns) {
          const match = context.match(pattern);
          if (match && match[1]) {
            // Validate it looks like a real license number
            const candidate = match[1];
            if (candidate.length >= 6 && /[0-9]/.test(candidate)) {
              return candidate;
            }
          }
        }
      } catch (err) {
        console.error(`Error trying search pattern ${searchUrl}:`, err);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Generic search error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentName, state, licensePortalUrl }: LicenseLookupRequest = await req.json();
    
    console.log(`Looking up license for ${agentName} in ${state}`);
    console.log(`Portal URL: ${licensePortalUrl}`);

    let licenseNumber: string | null = null;

    const upperState = state.toUpperCase();

    // Prefer state-specific logic for CA first (DRE results often expose only License_id)
    if (upperState === 'CA' || upperState === 'CALIFORNIA') {
      licenseNumber = await searchCalifornia(agentName);
    }

    // If still not found, try AI when a portal URL is provided
    if (!licenseNumber && licensePortalUrl) {
      console.log('Attempting AI-powered license lookup...');
      licenseNumber = await lookupWithAI(agentName, licensePortalUrl, state);
    }

    // Finally, try other state-specific scrapers or generic search
    if (!licenseNumber) {
      console.log('Trying state-specific or generic scraper...');
      switch (upperState) {
        case 'AZ':
        case 'ARIZONA':
          licenseNumber = await searchArizona(agentName);
          break;
        case 'TX':
        case 'TEXAS':
          licenseNumber = await searchTexas(agentName);
          break;
        case 'FL':
        case 'FLORIDA':
          licenseNumber = await searchFlorida(agentName);
          break;
        case 'CA':
        case 'CALIFORNIA':
          // Already tried CA above
          break;
        default:
          // Try generic search for other states
          licenseNumber = await genericSearch(agentName, licensePortalUrl);
      }
    }

    console.log(`License lookup result for ${agentName}: ${licenseNumber || 'Not found'}`);

    return new Response(
      JSON.stringify({
        success: true,
        licenseNumber,
        agentName,
        state,
        message: licenseNumber 
          ? `License number found: ${licenseNumber}` 
          : 'License number not found - the agent may not be licensed or manual verification is required',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in lookup-agent-license:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to lookup license - manual verification required',
      }),
      {
        status: 200, // Return 200 to not break import flow
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
