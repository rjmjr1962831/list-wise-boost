import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_API_TOKEN = Deno.env.get('PIPEDRIVE_API_TOKEN');
const PIPEDRIVE_DOMAIN = Deno.env.get('PIPEDRIVE_DOMAIN');

async function processInBackground(zillowUrl: string, reviewRequestId: string) {
  console.log(`🔄 Starting background processing for review request: ${reviewRequestId}`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const apifyToken = Deno.env.get('APIFY_API_TOKEN');

  let agentData: any = null;
  let agentName = 'Unknown Agent';
  let agentRating = 'N/A';
  let agentReviews = 'N/A';
  let agentCompany = 'N/A';
  let agentPhone = 'N/A';
  let agentYearsExp = 'N/A';
  let agentTotalSales = 'N/A';
  let scraperFailed = false;

  // Extract agent name from URL as initial fallback
  const urlMatch = zillowUrl.match(/\/profile\/([^\/\?]+)/);
  if (urlMatch) {
    agentName = urlMatch[1].replace(/-/g, ' ');
  }

  if (apifyToken) {
    try {
      console.log('🔍 Scraping Zillow profile with memo23...');
      
      const memo23ActorId = 'memo23~apify-zillow-agents-cheerio';
      const memo23Input = {
        startUrls: [{ url: zillowUrl }],
        maxConcurrency: 1,
        proxyConfiguration: { 
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };

      const memo23Response = await fetch(
        `https://api.apify.com/v2/acts/${memo23ActorId}/runs?token=${apifyToken}&waitForFinish=180`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(memo23Input)
        }
      );

      if (memo23Response.ok) {
        const memo23Data = await memo23Response.json();
        const agentDatasetId = memo23Data.data.defaultDatasetId;

        const agentDataResponse = await fetch(
          `https://api.apify.com/v2/datasets/${agentDatasetId}/items?token=${apifyToken}`
        );

        if (agentDataResponse.ok) {
          const agentDataResults = await agentDataResponse.json();
          
          if (agentDataResults && agentDataResults.length > 0) {
            agentData = agentDataResults[0];
            agentName = agentData.name || agentName;
            
            if (agentData.ratings) {
              agentRating = agentData.ratings.starRating?.toString() || 'N/A';
              agentReviews = agentData.ratings.numReviews?.toString() || 'N/A';
            }
            
            agentCompany = agentData.businessName || 'N/A';
            
            if (agentData.phoneNumbers && agentData.phoneNumbers.length > 0) {
              const primaryPhone = agentData.phoneNumbers.find((p: any) => p.primary) || agentData.phoneNumbers[0];
              agentPhone = primaryPhone?.formattedPhoneNumber || 'N/A';
            }
            
            if (agentData.agentSalesStats) {
              agentTotalSales = agentData.agentSalesStats.countAllTime?.toString() || 'N/A';
            }
            
            if (agentData.professionalInformation && Array.isArray(agentData.professionalInformation)) {
              const yearsEntry = agentData.professionalInformation.find((info: any) => 
                info.term?.toLowerCase().includes('year') || info.term?.toLowerCase().includes('experience')
              );
              if (yearsEntry?.description) {
                agentYearsExp = yearsEntry.description;
              }
            }
            
            console.log(`✅ Scraped: ${agentName} (${agentRating}⭐, ${agentReviews} reviews)`);
          } else {
            scraperFailed = true;
          }
        } else {
          scraperFailed = true;
        }
      } else {
        console.warn(`⚠️ memo23 failed with status: ${memo23Response.status}`);
        scraperFailed = true;
      }
    } catch (scraperError) {
      console.warn('⚠️ Scraper error:', scraperError instanceof Error ? scraperError.message : 'Unknown error');
      scraperFailed = true;
    }
  } else {
    scraperFailed = true;
  }

  // Update review request with scraped data
  const { error: updateError } = await supabase
    .from('review_requests')
    .update({
      full_name: agentName,
      brokerage: agentCompany !== 'N/A' ? agentCompany : 'Pending',
      phone: agentPhone !== 'N/A' ? agentPhone : 'Pending',
      message: `Zillow URL: ${zillowUrl}\n\n${scraperFailed ? '⚠️ SCRAPER FAILED - Manual review needed\n\n' : ''}Scraped Data:\n- Rating: ${agentRating}\n- Reviews: ${agentReviews}\n- Total Sales: ${agentTotalSales}\n- Years Experience: ${agentYearsExp}`
    })
    .eq('id', reviewRequestId);

  if (updateError) {
    console.error('❌ Failed to update review request:', updateError);
  } else {
    console.log(`💾 Updated review request: ${reviewRequestId}`);
  }

  // Create Pipedrive task
  if (PIPEDRIVE_API_TOKEN && PIPEDRIVE_DOMAIN) {
    const taskSubject = `🆕 Agent Review Request: ${agentName}`;
    
    const taskNote = `
**New Agent Review Request**

**Agent Name:** ${agentName}
**Zillow URL:** ${zillowUrl}

**Scraped Data:**
- Rating: ${agentRating} ⭐
- Reviews: ${agentReviews}
- Company: ${agentCompany}
- Phone: ${agentPhone}
- Total Sales: ${agentTotalSales}
- Years Experience: ${agentYearsExp}

**Qualification Check:**
${parseFloat(agentRating) >= 4.8 ? '✅' : '❌'} Rating 4.8+ (Current: ${agentRating})
${parseInt(agentReviews) >= 50 ? '✅' : '❌'} 50+ Reviews (Current: ${agentReviews})

---
*Submitted via Top10Lists.us - Are You an Agent? page*
*Review Request ID: ${reviewRequestId}*
    `.trim();

    const activityData = {
      subject: taskSubject,
      type: 'task',
      public_description: taskNote,
      due_date: new Date().toISOString().split('T')[0],
      due_time: '09:00',
      done: false
    };

    try {
      const pipedriveResponse = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/activities?api_token=${PIPEDRIVE_API_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activityData)
        }
      );

      if (pipedriveResponse.ok) {
        console.log('✅ Pipedrive task created');
      }
    } catch (e) {
      console.error('⚠️ Pipedrive task creation failed:', e);
    }
  }

  // Send email notification
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (resendApiKey) {
    const qualificationStatus = parseFloat(agentRating) >= 4.8 && parseInt(agentReviews) >= 50 
      ? '✅ LIKELY QUALIFIES' 
      : '⚠️ MAY NOT QUALIFY';

    const emailHtml = `
      <h2>🆕 New Agent Review Request</h2>
      
      <p><strong>Status:</strong> ${qualificationStatus}</p>
      
      <h3>Agent Information</h3>
      <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
        <tr style="background: #f5f5f5;">
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Name</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${agentName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Zillow URL</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;"><a href="${zillowUrl}">${zillowUrl}</a></td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Rating</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${agentRating} ⭐</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reviews</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${agentReviews}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Company</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${agentCompany}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Phone</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${agentPhone}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Sales</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${agentTotalSales}</td>
        </tr>
      </table>
      
      <h3>Qualification Check</h3>
      <ul>
        <li>${parseFloat(agentRating) >= 4.8 ? '✅' : '❌'} Rating 4.8+ (Current: ${agentRating})</li>
        <li>${parseInt(agentReviews) >= 50 ? '✅' : '❌'} 50+ Reviews (Current: ${agentReviews})</li>
      </ul>
      
      <p><strong>Next Steps:</strong> Review this agent in Pipedrive and respond within 24 hours.</p>
      
      <hr>
      <p style="color: #666; font-size: 12px;">Review Request ID: ${reviewRequestId}</p>
    `;

    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Top10Lists <notifications@top10lists.us>',
          to: ['robert@top10lists.us'],
          subject: `🆕 Agent Review Request: ${agentName} (${qualificationStatus})`,
          html: emailHtml
        })
      });
      
      const emailResult = await emailResponse.json();
      if (emailResponse.ok) {
        console.log('📧 Email notification sent successfully:', emailResult.id);
      } else {
        console.error('❌ Resend API error:', JSON.stringify(emailResult));
      }
    } catch (emailError) {
      console.error('⚠️ Email failed:', emailError);
    }
  }

  console.log(`✅ Background processing complete for: ${reviewRequestId}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zillowUrl } = await req.json();

    if (!zillowUrl) {
      throw new Error('zillowUrl is required');
    }

    console.log(`📝 Processing review request for: ${zillowUrl}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract agent name from URL for initial record
    let agentName = 'Unknown Agent';
    const urlMatch = zillowUrl.match(/\/profile\/([^\/\?]+)/);
    if (urlMatch) {
      agentName = urlMatch[1].replace(/-/g, ' ');
    }

    // Save initial review request to database immediately
    const { data: reviewRequest, error: dbError } = await supabase
      .from('review_requests')
      .insert({
        full_name: agentName,
        email: `review-request-${Date.now()}@pending.top10lists.us`,
        phone: 'Pending',
        license_number: 'Pending Review',
        brokerage: 'Pending',
        message: `Zillow URL: ${zillowUrl}\n\n⏳ Scraping in progress...`,
        status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      throw new Error(`Failed to save review request: ${dbError.message}`);
    }

    console.log(`💾 Created review request: ${reviewRequest.id}, starting background processing...`);

    // Run memo23 scraping and notifications in background
    EdgeRuntime.waitUntil(processInBackground(zillowUrl, reviewRequest.id));

    // Return success immediately
    return new Response(
      JSON.stringify({
        success: true,
        reviewRequestId: reviewRequest.id,
        agentName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error processing review request:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
