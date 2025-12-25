import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueStatus {
  name: string;
  isRunning: boolean;
  lastActivity: Date | null;
  currentIndex: number;
  totalProcessed: number;
  minutesSinceActivity: number;
}

async function sendAlertEmail(subject: string, body: string) {
  const smtpUsername = Deno.env.get('SMTP_USERNAME');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  const smtpFromEmail = Deno.env.get('SMTP_FROM_EMAIL');
  const adminEmail = Deno.env.get('ADMIN_EMAIL');

  if (!smtpUsername || !smtpPassword || !adminEmail) {
    console.error('Missing SMTP credentials or admin email');
    return false;
  }

  try {
    const client = new SmtpClient();
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: smtpUsername,
      password: smtpPassword,
    });

    await client.send({
      from: smtpFromEmail || smtpUsername,
      to: adminEmail,
      subject: subject,
      content: body,
    });

    await client.close();
    console.log(`✅ Alert email sent: ${subject}`);
    return true;
  } catch (error) {
    console.error('Failed to send alert email:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const alerts: string[] = [];
    const statuses: QueueStatus[] = [];

    // Check Firecrawl/State License Pipeline
    const { data: pipelineData, error: pipelineError } = await supabase
      .from('pipeline_state')
      .select('*')
      .order('last_run_at', { ascending: false })
      .limit(1)
      .single();

    if (pipelineError) {
      console.error('Error fetching pipeline state:', pipelineError);
    } else if (pipelineData) {
      const lastRun = pipelineData.last_run_at ? new Date(pipelineData.last_run_at) : null;
      const minutesSinceActivity = lastRun 
        ? Math.floor((now.getTime() - lastRun.getTime()) / 60000)
        : 999;

      const firecrawlStatus: QueueStatus = {
        name: `Firecrawl Pipeline (${pipelineData.state_abbr})`,
        isRunning: pipelineData.is_running && !pipelineData.is_paused,
        lastActivity: lastRun,
        currentIndex: pipelineData.current_index,
        totalProcessed: pipelineData.total_processed,
        minutesSinceActivity,
      };
      statuses.push(firecrawlStatus);

      // Alert if not running or stalled for more than 15 minutes
      if (!firecrawlStatus.isRunning) {
        alerts.push(`🛑 Firecrawl Pipeline STOPPED (${pipelineData.state_abbr})`);
      } else if (minutesSinceActivity > 15) {
        alerts.push(`⚠️ Firecrawl Pipeline STALLED - No activity for ${minutesSinceActivity} minutes`);
      }
    }

    // Check Contact Enrichment Queue
    const { data: enrichmentPending } = await supabase
      .from('contact_enrichment_queue')
      .select('id, created_at, updated_at, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    const { data: enrichmentInProgress } = await supabase
      .from('contact_enrichment_queue')
      .select('id, started_at, updated_at')
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1);

    const { count: pendingCount } = await supabase
      .from('contact_enrichment_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const enrichmentStatus: QueueStatus = {
      name: 'Contact Enrichment Queue',
      isRunning: (pendingCount || 0) > 0 || (enrichmentInProgress?.length || 0) > 0,
      lastActivity: enrichmentInProgress?.[0]?.updated_at 
        ? new Date(enrichmentInProgress[0].updated_at)
        : null,
      currentIndex: 0,
      totalProcessed: 0,
      minutesSinceActivity: 0,
    };

    if (enrichmentInProgress?.[0]?.started_at) {
      const startedAt = new Date(enrichmentInProgress[0].started_at);
      enrichmentStatus.minutesSinceActivity = Math.floor((now.getTime() - startedAt.getTime()) / 60000);
      
      // Alert if in_progress for more than 30 minutes (likely stuck)
      if (enrichmentStatus.minutesSinceActivity > 30) {
        alerts.push(`⚠️ Contact Enrichment STUCK - In progress for ${enrichmentStatus.minutesSinceActivity} minutes`);
      }
    }

    statuses.push(enrichmentStatus);

    // Send email if there are alerts
    if (alerts.length > 0) {
      const emailBody = `
Queue Monitor Alert - ${now.toISOString()}

${alerts.join('\n\n')}

--- Current Status ---
${statuses.map(s => `
${s.name}:
  Running: ${s.isRunning ? 'Yes' : 'NO'}
  Last Activity: ${s.lastActivity?.toISOString() || 'Unknown'}
  Minutes Since Activity: ${s.minutesSinceActivity}
  Processed: ${s.totalProcessed}
`).join('\n')}

Check admin dashboard: https://top10lists.us/admin
      `.trim();

      await sendAlertEmail(
        `🚨 Queue Alert: ${alerts.length} issue(s) detected`,
        emailBody
      );
    }

    const response = {
      timestamp: now.toISOString(),
      alerts,
      statuses: statuses.map(s => ({
        ...s,
        lastActivity: s.lastActivity?.toISOString() || null,
      })),
      emailSent: alerts.length > 0,
    };

    console.log('Queue monitor check:', JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Monitor error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
