import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_API_TOKEN = Deno.env.get('PIPEDRIVE_API_TOKEN');
const PIPEDRIVE_DOMAIN = Deno.env.get('PIPEDRIVE_DOMAIN');

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

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Step 1: Scrape profile with memo23
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

    if (!memo23Response.ok) {
      throw new Error(`memo23 scraping failed: ${memo23Response.status}`);
    }

    const memo23Data = await memo23Response.json();
    const agentDatasetId = memo23Data.data.defaultDatasetId;

    const agentDataResponse = await fetch(
      `https://api.apify.com/v2/datasets/${agentDatasetId}/items?token=${apifyToken}`
    );

    if (!agentDataResponse.ok) {
      throw new Error('Failed to get scraped agent data');
    }

    const agentDataResults = await agentDataResponse.json();
    
    let agentData: any = null;
    let agentName = 'Unknown Agent';
    let agentRating = 'N/A';
    let agentReviews = 'N/A';
    let agentCompany = 'N/A';
    let agentPhone = 'N/A';
    let agentEmail = 'N/A';
    let agentYearsExp = 'N/A';
    let agentTotalSales = 'N/A';

    if (agentDataResults && agentDataResults.length > 0) {
      agentData = agentDataResults[0];
      agentName = agentData.name || 'Unknown Agent';
      
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
      
      // Try to extract years of experience from professional information
      if (agentData.professionalInformation && Array.isArray(agentData.professionalInformation)) {
        const yearsEntry = agentData.professionalInformation.find((info: any) => 
          info.term?.toLowerCase().includes('year') || info.term?.toLowerCase().includes('experience')
        );
        if (yearsEntry?.description) {
          agentYearsExp = yearsEntry.description;
        }
      }
      
      console.log(`✅ Scraped data for: ${agentName} (${agentRating}⭐, ${agentReviews} reviews)`);
    } else {
      console.log('⚠️ No data returned from scraper, continuing with URL only');
    }

    // Step 2: Save review request to database
    const { data: reviewRequest, error: dbError } = await supabase
      .from('review_requests')
      .insert({
        full_name: agentName,
        email: agentEmail !== 'N/A' ? agentEmail : `review-request-${Date.now()}@pending.top10lists.us`,
        phone: agentPhone !== 'N/A' ? agentPhone : 'Pending',
        license_number: 'Pending Review',
        brokerage: agentCompany !== 'N/A' ? agentCompany : 'Pending',
        message: `Zillow URL: ${zillowUrl}\n\nScraped Data:\n- Rating: ${agentRating}\n- Reviews: ${agentReviews}\n- Total Sales: ${agentTotalSales}\n- Years Experience: ${agentYearsExp}`,
        status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      throw new Error(`Failed to save review request: ${dbError.message}`);
    }

    console.log(`💾 Saved review request to database: ${reviewRequest.id}`);

    // Step 3: Create Pipedrive task (pending state = done: false)
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
*Review Request ID: ${reviewRequest.id}*
      `.trim();

      const activityData = {
        subject: taskSubject,
        type: 'task',
        public_description: taskNote,
        due_date: new Date().toISOString().split('T')[0],
        due_time: '09:00',
        done: false // Pending state
      };

      console.log('📤 Creating Pipedrive task...');

      const pipedriveResponse = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/activities?api_token=${PIPEDRIVE_API_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activityData)
        }
      );

      const pipedriveResult = await pipedriveResponse.json();

      if (pipedriveResponse.ok && pipedriveResult.success) {
        console.log(`✅ Pipedrive task created: ${pipedriveResult.data?.id}`);
      } else {
        console.error('⚠️ Pipedrive task creation failed:', pipedriveResult);
      }
    } else {
      console.log('⚠️ Pipedrive not configured, skipping task creation');
    }

    // Step 4: Send email notification via Resend API
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
        <p style="color: #666; font-size: 12px;">Review Request ID: ${reviewRequest.id}</p>
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
        
        if (emailResponse.ok) {
          console.log('📧 Email notification sent to robert@top10lists.us');
        } else {
          const emailError = await emailResponse.text();
          console.error('⚠️ Email failed:', emailError);
        }
      } catch (emailError) {
        console.error('⚠️ Email failed:', emailError);
      }
    } else {
      console.log('⚠️ RESEND_API_KEY not configured, skipping email');
    }

    return new Response(
      JSON.stringify({
        success: true,
        reviewRequestId: reviewRequest.id,
        agentName,
        agentRating,
        agentReviews
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
