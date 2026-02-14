/**
 * Agent Notifications Queue Consumer
 * Processes bot detection events from agent-notifications-queue.
 * POSTs to notification endpoint for Citation Alerts.
 * Guaranteed delivery: ack on success, retry on failure.
 */

const DEFAULT_NOTIFY_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/log-bot-visit';

export default {
  async queue(batch, env, ctx) {
    const notifyUrl = env.NOTIFICATION_ENDPOINT || DEFAULT_NOTIFY_URL;

    for (const message of batch.messages) {
      try {
        const body = message.body;
        const url = body.request_url || '';
        const path = url ? new URL(url).pathname : null;
        const res = await fetch(notifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(env.NOTIFICATION_AUTH_TOKEN && {
              'Authorization': `Bearer ${env.NOTIFICATION_AUTH_TOKEN}`,
            }),
          },
          body: JSON.stringify({
            url: url || path,
            path,
            bot_type: body.bot_name,
            timestamp: body.timestamp,
            user_agent: body.user_agent || null,
            method: 'GET',
          }),
        });

        if (res.ok) {
          message.ack();
        } else {
          console.error(`Notify failed ${res.status}: ${await res.text()}`);
          message.retry();
        }
      } catch (err) {
        console.error('Notify error:', err.message);
        message.retry();
      }
    }
  },
};
