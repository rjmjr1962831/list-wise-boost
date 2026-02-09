import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BotNotificationParams {
  frequency?: 'instant' | 'daily' | 'weekly';
  agent_id?: string; // Optional: send to specific agent
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: BotNotificationParams = req.method === 'POST' 
      ? await req.json() 
      : { frequency: 'daily' };
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log(`[send-bot-notifications] Starting for frequency: ${params.frequency}`);
    
    // Determine date range based on frequency
    const now = new Date();
    let startDate: Date;
    
    switch (params.frequency) {
      case 'instant':
        startDate = new Date(now.getTime() - 60 * 60 * 1000); // Last hour
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
        break;
      case 'daily':
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
        break;
    }
    
    // Get agents who should receive notifications
    let prefsQuery = supabase
      .from('agent_bot_notification_preferences')
      .select('agent_id, notification_frequency, notify_for_bots, last_notification_sent_at')
      .eq('email_notifications_enabled', true)
      .eq('notification_frequency', params.frequency || 'daily');
    
    if (params.agent_id) {
      prefsQuery = prefsQuery.eq('agent_id', params.agent_id);
    }
    
    const { data: preferences, error: prefsError } = await prefsQuery;
    
    if (prefsError) throw prefsError;
    
    console.log(`[send-bot-notifications] Found ${preferences?.length || 0} agents to notify`);
    
    const emailsSent = [];
    
    for (const pref of preferences || []) {
      // Get agent details
      const { data: agent } = await supabase
        .from('professionals')
        .select('id, name, email, canonical_slug')
        .eq('id', pref.agent_id)
        .single();
      
      if (!agent || !agent.email) continue;
      
      // Get bot visit summary for the period
      const { data: summary } = await supabase
        .from('agent_bot_visit_summary')
        .select('*')
        .eq('agent_id', pref.agent_id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      if (!summary || summary.length === 0) {
        console.log(`[send-bot-notifications] No bot visits for agent ${agent.name}`);
        continue;
      }
      
      // Calculate totals across all days
      const totalVisits = summary.reduce((sum, day) => sum + day.total_bot_visits, 0);
      const allBots = new Set<string>();
      summary.forEach(day => day.unique_bots?.forEach((bot: string) => allBots.add(bot)));
      
      // Get detailed visits
      const { data: detailedVisits } = await supabase
        .from('cloudflare_request_logs')
        .select('timestamp, bot_type, path, cache_status')
        .eq('agent_id', pref.agent_id)
        .eq('is_bot', true)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false })
        .limit(20);
      
      // Group visits by bot type
      const visitsByBot: Record<string, number> = {};
      detailedVisits?.forEach(visit => {
        visitsByBot[visit.bot_type] = (visitsByBot[visit.bot_type] || 0) + 1;
      });
      
      // Send email
      const emailSent = await sendBotNotificationEmail(agent, {
        totalVisits,
        uniqueBots: Array.from(allBots),
        visitsByBot,
        recentVisits: detailedVisits || [],
        period: params.frequency || 'daily',
        dashboardUrl: `https://www.top10lists.us/agent/bot-analytics`
      });
      
      if (emailSent) {
        // Update last notification sent timestamp
        await supabase
          .from('agent_bot_notification_preferences')
          .update({ last_notification_sent_at: now.toISOString() })
          .eq('agent_id', pref.agent_id);
        
        emailsSent.push(agent.email);
      }
    }
    
    console.log(`[send-bot-notifications] Sent ${emailsSent.length} emails`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        emails_sent: emailsSent.length,
        recipients: emailsSent
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[send-bot-notifications] Error:", errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendBotNotificationEmail(
  agent: any,
  data: {
    totalVisits: number;
    uniqueBots: string[];
    visitsByBot: Record<string, number>;
    recentVisits: any[];
    period: string;
    dashboardUrl: string;
  }
): Promise<boolean> {
  const botEmojis: Record<string, string> = {
    googlebot: '🔍',
    claudebot: '🤖',
    gptbot: '🧠',
    bingbot: '🔎',
    perplexitybot: '💡',
    unknown_bot: '🤔'
  };
  
  const botNames: Record<string, string> = {
    googlebot: 'Google',
    claudebot: 'Claude AI',
    gptbot: 'ChatGPT',
    bingbot: 'Bing',
    perplexitybot: 'Perplexity AI',
    unknown_bot: 'Unknown Bot'
  };
  
  const periodLabel = data.period === 'daily' ? 'today' : `in the last ${data.period === 'weekly' ? 'week' : 'hour'}`;
  
  // Build bot breakdown HTML
  const botBreakdownHtml = Object.entries(data.visitsByBot)
    .sort(([, a], [, b]) => b - a)
    .map(([bot, count]) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
          ${botEmojis[bot] || '🤖'} ${botNames[bot] || bot}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">
          ${count}
        </td>
      </tr>
    `).join('');
  
  // Build recent visits HTML (top 5)
  const recentVisitsHtml = data.recentVisits.slice(0, 5).map(visit => {
    const date = new Date(visit.timestamp);
    const timeAgo = getTimeAgo(date);
    const pageType = visit.path.includes('/artifact/') ? 'Artifact Page' : 'Profile Page';
    
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
          ${botEmojis[visit.bot_type] || '🤖'} ${botNames[visit.bot_type] || visit.bot_type}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${pageType}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          ${timeAgo}
        </td>
      </tr>
    `;
  }).join('');
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">🤖 AI Bot Activity Report</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your profile was discovered ${periodLabel}!</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Hi ${agent.name},</h2>
          <p style="font-size: 16px; color: #374151;">
            Your Top10Lists profile received <strong style="color: #667eea; font-size: 24px;">${data.totalVisits}</strong> bot visits from <strong>${data.uniqueBots.length}</strong> different AI systems ${periodLabel}.
          </p>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin-top: 0; color: #111827; font-size: 18px;">📊 Bot Breakdown</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${botBreakdownHtml}
          </table>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin-top: 0; color: #111827; font-size: 18px;">🕐 Recent Activity</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 8px; text-align: left; font-size: 14px; color: #6b7280;">Bot</th>
                <th style="padding: 8px; text-align: left; font-size: 14px; color: #6b7280;">Page</th>
                <th style="padding: 8px; text-align: left; font-size: 14px; color: #6b7280;">When</th>
              </tr>
            </thead>
            <tbody>
              ${recentVisitsHtml}
            </tbody>
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${data.dashboardUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            View Full Dashboard →
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
          <p>This helps you understand which AI systems are discovering and potentially recommending your services.</p>
          <p style="margin-top: 15px;">
            <a href="https://www.top10lists.us/agent/settings" style="color: #667eea; text-decoration: none;">Notification Settings</a>
          </p>
        </div>
      </div>
      
    </body>
    </html>
  `;
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Top10Lists Bot Tracker <notifications@top10lists.us>',
        to: agent.email,
        subject: `${data.uniqueBots.map(b => botEmojis[b] || '🤖').join(' ')} AI bots visited your profile ${periodLabel}`,
        html: htmlBody
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[send-bot-notifications] Resend API error for ${agent.email}:`, error);
      return false;
    }
    
    console.log(`[send-bot-notifications] Email sent to ${agent.email}`);
    return true;
    
  } catch (error) {
    console.error(`[send-bot-notifications] Failed to send email to ${agent.email}:`, error);
    return false;
  }
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
