# Payment System Deployment

## ONE COMMAND TO DEPLOY EVERYTHING

```bat
git pull
DEPLOY-PAYMENT-SYSTEM.bat
```

This script will:
1. ✅ Deploy badge-image Edge Function (automated)
2. ✅ Test the function (automated)
3. ⏸️ Pause for you to run database migration SQL
4. ⏸️ Pause for you to run cron job SQL
5. ⏸️ Pause for you to configure Stripe webhook
6. ✅ Test all endpoints (automated)

## What You'll Need

- Supabase SQL Editor open
- Stripe Dashboard access
- 5 minutes

## Files Included

- `DEPLOY-PAYMENT-SYSTEM.bat` - Main deployment script
- `badge_tier_migration.sql` - Database schema changes
- `grace_period_cron.sql` - Daily cleanup job

## After Deployment

System will handle:
- $50/month → Accredited (gold badge)
- $150/month → Underwritten (yellow badge)  
- Payment failure → 3-day grace period
- Grace expiry → Downgrade to certified
- Cancellation → Immediate downgrade

## Support

All files are in your project root after `git pull`.

Run `DEPLOY-PAYMENT-SYSTEM.bat` and follow the prompts.
