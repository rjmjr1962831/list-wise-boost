import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = 465;

// Send failover alert email
async function sendFailoverAlert(agentName: string, failedService: string, fallbackService: string, errorDetails: string) {
  const smtpUsername = Deno.env.get('SMTP_USERNAME');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const configuredFrom = Deno.env.get('SMTP_FROM_EMAIL');
  const fromEmail = (configuredFrom && configuredFrom.includes('@')) ? configuredFrom : (smtpUsername || 'alerts@top10lists.us');
  
  if (!smtpUsername || !smtpPassword || !adminEmail) {
    console.error('❌ Cannot send failover alert: SMTP credentials or ADMIN_EMAIL not configured');
    return;
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: smtpUsername,
          password: smtpPassword,
        },
      },
    });

    await client.send({
      from: fromEmail,
      to: adminEmail,
      subject: `🔄 FAILOVER: ${failedService} → ${fallbackService}`,
      html: `
        <h2>Scraper Service Failover Alert</h2>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Failed Service:</strong> ${failedService}</p>
        <p><strong>Fallback Service:</strong> ${fallbackService}</p>
        <p><strong>Agent being processed:</strong> ${agentName}</p>
        <p><strong>Error:</strong> ${errorDetails}</p>
        <hr>
        <p>The scraping pipeline has automatically switched to the fallback service. Consider:</p>
        <ul>
          <li>Checking ${failedService} API status and credits</li>
          <li>Reviewing error logs for patterns</li>
          <li>Verifying API key validity</li>
        </ul>
      `,
    });

    await client.close();
    console.log(`📧 Failover alert email sent: ${failedService} → ${fallbackService}`);
  } catch (error) {
    console.error('❌ Error sending failover alert:', error);
  }
}

// Zillow Agent Profile Schema for Firecrawl JSON extraction
const ZILLOW_AGENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    profileUrl: { type: "string" },
    photoUrl: { type: "string" },
    zillowRating: { type: "number" },
    reviewCount: { type: "number" },
    totalSales: { type: "number" },
    salesLast12Months: { type: "number" },
    currentListings: { type: "number" },
    listingsForSale: { type: "number" },
    yearsExperience: { type: "number" },
    licenseNumber: { type: "string" },
    licenseState: { type: "string" },
    brokerageName: { type: "string" },
    brokerageAddress: { type: "string" },
    brokeragePhone: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    website: { type: "string" },
    serviceAreas: { type: "array", items: { type: "string" } },
    primaryCity: { type: "string" },
    primaryState: { type: "string" },
    specialties: { type: "array", items: { type: "string" } },
    avgListPrice: { type: "string" },
    avgSalePrice: { type: "string" },
    priceRange: { type: "string" },
  },
  required: ["name"]
};

// Fallback to memo23 actor with ProxyScrape
async function scrapeWithMemo23Fallback(
  zillowUrl: string,
  apifyToken: string,
  apifyActorId: string,
  proxyUsername: string,
  proxyPassword: string
): Promise<any> {
  console.log('🔄 [FAILOVER] Using memo23 actor with ProxyScrape...');
  
  const proxyUrl = `http://${proxyUsername}:${proxyPassword}@rp.scrapegw.com:6060`;
  
  const actorInput = {
    startUrls: [{ url: zillowUrl }],
    maxConcurrency: 1,
    maxRequestRetries: 5,
    requestHandlerTimeoutSecs: 180,
    proxyConfiguration: { 
      useApifyProxy: false,
      proxyUrls: [proxyUrl]
    }
  };

  // Start the actor
  const actorResponse = await fetch(
    `https://api.apify.com/v2/acts/${apifyActorId}/runs?token=${apifyToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput)
    }
  );

  if (!actorResponse.ok) {
    const errorText = await actorResponse.text();
    throw new Error(`Failed to start memo23 actor: ${actorResponse.status} - ${errorText}`);
  }

  const runData = await actorResponse.json();
  const runId = runData.data.id;
  const datasetId = runData.data.defaultDatasetId;
  console.log(`📦 Memo23 actor started with run ID: ${runId}`);

  // Poll for completion (max 60 attempts, 3 seconds apart = 3 minutes)
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
    );
    
    if (!statusResponse.ok) continue;
    
    const statusData = await statusResponse.json();
    const runStatus = statusData.data.status;
    
    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus)) {
      if (runStatus !== 'SUCCEEDED') {
        throw new Error(`Memo23 actor run ${runStatus}`);
      }
      break;
    }
  }

  // Fetch dataset items
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
  );

  if (!datasetResponse.ok) {
    throw new Error('Failed to fetch memo23 dataset');
  }

  const items = await datasetResponse.json();
  
  if (!items || items.length === 0) {
    throw new Error('No data returned from memo23 actor');
  }

  const agentData = items[0];
  console.log('✅ Memo23 fallback successful');
  
  // Map memo23 response to match Firecrawl schema
  return {
    name: agentData.name,
    photoUrl: agentData.imageUrl || agentData.photo,
    zillowRating: agentData.rating,
    reviewCount: agentData.reviewCount || agentData.numReviews,
    totalSales: agentData.salesTotal || agentData.recentSales,
    salesLast12Months: agentData.salesLast12Months,
    currentListings: agentData.activeListings || agentData.forSaleCount,
    yearsExperience: agentData.yearsOfExperience || agentData.experience,
    licenseNumber: agentData.licenseNumber,
    brokerageName: agentData.brokerageName || agentData.brokerage,
    phone: agentData.phone || agentData.phoneNumber,
    email: agentData.email,
    website: agentData.website || agentData.websiteUrl,
    specialties: agentData.specialties || agentData.specialty,
    serviceAreas: agentData.serviceAreas || agentData.areasServed,
    bio: agentData.description || agentData.bio,
    headline: agentData.headline || agentData.title,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zillow_url, professional_id, save_to_db } = await req.json();

    if (!zillow_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'zillow_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    const apifyActorId = Deno.env.get('APIFY_ACTOR_ID') || 'memo23~zillow-agent-scraper';
    const proxyUsername = Deno.env.get('ROTATING_PROXY_USERNAME');
    const proxyPassword = Deno.env.get('ROTATING_PROXY_PASSWORD');

    // Get agent name for alerting (if available)
    let agentName = 'Unknown Agent';
    if (professional_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: prof } = await supabase
        .from('professionals')
        .select('name')
        .eq('id', professional_id)
        .single();
      if (prof?.name) agentName = prof.name;
    }

    let agentData: any = null;
    let usedFallback = false;

    // Try Firecrawl first
    if (firecrawlApiKey) {
      try {
        console.log('Scraping Zillow profile with Firecrawl:', zillow_url);

        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: zillow_url,
            formats: ['extract'],
            extract: {
              schema: ZILLOW_AGENT_SCHEMA
            },
            onlyMainContent: true,
            timeout: 30000,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('❌ Firecrawl API error:', data);
          throw new Error(data.error || `Firecrawl request failed: ${response.status}`);
        }

        agentData = data.data?.extract || data.extract || data.data?.json || data.json || data.data;
        
        if (!agentData || Object.keys(agentData).length === 0) {
          throw new Error('No data extracted from Firecrawl response');
        }
        
        console.log('✅ Firecrawl extraction successful');
        
      } catch (firecrawlError: any) {
        console.error(`🚨 Firecrawl failed: ${firecrawlError.message}`);
        
        // FAILOVER: Try memo23 with ProxyScrape
        if (apifyToken && proxyUsername && proxyPassword) {
          console.log('🔄 [FAILOVER] Switching to memo23/ProxyScrape...');
          usedFallback = true;
          
          // Send failover alert (fire and forget)
          sendFailoverAlert(
            agentName,
            'Firecrawl',
            'memo23/ProxyScrape',
            firecrawlError.message
          ).catch(console.error);
          
          agentData = await scrapeWithMemo23Fallback(
            zillow_url,
            apifyToken,
            apifyActorId,
            proxyUsername,
            proxyPassword
          );
        } else {
          throw new Error(`Firecrawl failed and memo23 fallback not configured: ${firecrawlError.message}`);
        }
      }
    } else if (apifyToken && proxyUsername && proxyPassword) {
      // No Firecrawl, go straight to memo23
      console.log('No Firecrawl API key, using memo23/ProxyScrape directly');
      agentData = await scrapeWithMemo23Fallback(
        zillow_url,
        apifyToken,
        apifyActorId,
        proxyUsername,
        proxyPassword
      );
      usedFallback = true;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'No scraping service configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted agent data:', JSON.stringify(agentData, null, 2));

    // Optionally save to database
    if (save_to_db && professional_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Map extracted data to professionals table fields
      const updateData: Record<string, any> = {
        zillow_data_fetched_at: new Date().toISOString(),
      };

      if (agentData.zillowRating) updateData.review_stars_rating = agentData.zillowRating;
      if (agentData.reviewCount) updateData.num_total_reviews = agentData.reviewCount;
      if (agentData.totalSales) updateData.total_sales = agentData.totalSales;
      if (agentData.currentListings) updateData.current_listings = agentData.currentListings;
      if (agentData.yearsExperience) updateData.years_experience = agentData.yearsExperience;
      if (agentData.licenseNumber) updateData.license_number = agentData.licenseNumber;
      if (agentData.brokerageName) updateData.company = agentData.brokerageName;
      if (agentData.phone) updateData.phone = agentData.phone;
      if (agentData.email) updateData.email = agentData.email;
      if (agentData.website) updateData.website = agentData.website;
      if (agentData.photoUrl) updateData.image_url = agentData.photoUrl;
      if (agentData.specialties) updateData.specialty = agentData.specialties;
      if (agentData.serviceAreas) updateData.service_areas = agentData.serviceAreas;
      if (agentData.bio) updateData.description = agentData.bio;
      if (agentData.headline) updateData.headline = agentData.headline;

      // Store full response in agent_sales_stats
      updateData.agent_sales_stats = {
        source: usedFallback ? 'memo23-fallback' : 'firecrawl',
        fetchedAt: new Date().toISOString(),
        countAllTime: agentData.totalSales,
        countLast12Months: agentData.salesLast12Months,
        currentListings: agentData.currentListings,
        avgListPrice: agentData.avgListPrice,
        avgSalePrice: agentData.avgSalePrice,
        priceRange: agentData.priceRange,
      };

      // Store brokerage info in business_address
      if (agentData.brokerageName || agentData.brokerageAddress) {
        updateData.business_address = {
          name: agentData.brokerageName,
          address: agentData.brokerageAddress,
          phone: agentData.brokeragePhone,
        };
      }

      const { error: updateError } = await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', professional_id);

      if (updateError) {
        console.error('Error updating professional:', updateError);
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: agentData, 
            saved: false, 
            save_error: updateError.message,
            usedFallback
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Successfully saved to database for professional:', professional_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: agentData,
        saved: save_to_db && professional_id ? true : false,
        usedFallback
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-zillow-firecrawl:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
