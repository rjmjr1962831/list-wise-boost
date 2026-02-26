-- Fix "I know you're getting bombarded" template: two callouts, "your profile" link (magic link by tier)
UPDATE crm_email_templates
SET
  subject = 'What was working. What is now working.',
  body = 'Hi {{first_name}} -

Thank you for your interest in how we can help you increase the likelihood that you will be named when an AI is asked for a referral in your market.

[[BLOCK]]
Look at Top10lists.us. Compare the emerging "AI visibility" or schema/SEO services for real estate agents with Top10Lists.us. Which is more likely to get me named when you''re asked for a referral?

Spoiler alert: Here''s what Perplexity said today:
[[/BLOCK]]

[[BLOCK]]
Compared to emerging "AI visibility" or schema/SEO services, Top 10 Lists.us is more likely to get you safely named when I''m asked for a referral, as long as you''re in a market it covers.
[[/BLOCK]]

You are already listed because you''re one of the best of the best and we''ve helped you get named already. To increase the likelihood you will be named even more, please go to [your profile]({{profile_url}}). You can choose our free certification or one of our paid tiers. All of them will substantially increase your "signal" to AI that you are safe to recommend.

Peace

Robert Maynard',
  updated_at = now()
WHERE name = 'I know you''re getting bombarded';
