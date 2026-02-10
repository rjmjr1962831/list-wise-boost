@echo off
echo ========================================
echo PAYMENT SYSTEM - ONE COMMAND DEPLOYMENT
echo ========================================
echo.

cd C:\Edge\list-wise-boost

echo.
echo ========================================
echo STEP 1: Deploy Badge Image Edge Function
echo ========================================
echo.
C:\Users\rober\supabase.exe functions deploy badge-image --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Edge Function deployment failed
    pause
    exit /b 1
)

echo.
echo ✅ Edge Function deployed successfully
echo.

echo ========================================
echo STEP 2: Test Badge Image Endpoint
echo ========================================
echo.

timeout /t 5 /nobreak > nul

curl -s "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/badge-image/1b975c55-a33b-4d21-8998-dc2d9b2dd91d" -o "%TEMP%\test-badge.png"

if exist "%TEMP%\test-badge.png" (
    echo ✅ Badge image endpoint working
    echo Opening badge image...
    start "" "%TEMP%\test-badge.png"
) else (
    echo ❌ Badge image endpoint failed
)

echo.
echo ========================================
echo STEP 3: Database Migration Instructions
echo ========================================
echo.
echo MANUAL STEP REQUIRED:
echo.
echo 1. Open: https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/sql/new
echo 2. Copy the SQL from: badge_tier_migration.sql
echo 3. Click "RUN"
echo 4. You should see "Success. No rows returned"
echo.
start "" "https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/sql/new"
echo.
echo Press any key AFTER running the migration SQL...
pause > nul
echo.

echo ========================================
echo STEP 4: Grace Period Cron Job
echo ========================================
echo.
echo MANUAL STEP REQUIRED:
echo.
echo In the SAME SQL Editor window:
echo 1. Copy the SQL from: grace_period_cron.sql
echo 2. Click "RUN"
echo 3. You should see "Success. No rows returned"
echo.
echo Press any key AFTER running the cron SQL...
pause > nul
echo.

echo ========================================  
echo STEP 5: Stripe Webhook Setup
echo ========================================
echo.
echo MANUAL STEP REQUIRED:
echo.
echo 1. Open: https://dashboard.stripe.com/webhooks
echo 2. Click "Add endpoint"
echo 3. Endpoint URL: https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/stripe-webhook
echo 4. Select events:
echo    - invoice.paid
echo    - invoice.payment_failed  
echo    - customer.subscription.deleted
echo    - customer.subscription.updated
echo 5. Click "Add endpoint"
echo 6. Click "Reveal" on signing secret
echo 7. Copy the whsec_... value
echo.
start "" "https://dashboard.stripe.com/webhooks"
echo.
set /p WEBHOOK_SECRET="Paste the Stripe signing secret (whsec_...): "
echo.
echo Setting Stripe webhook secret...
C:\Users\rober\supabase.exe secrets set STRIPE_WEBHOOK_SECRET=%WEBHOOK_SECRET% --project-ref wiotrvoirdgzfacuuiem
echo.

echo ========================================
echo TESTING COMPLETE SYSTEM
echo ========================================
echo.

echo Testing badge payload endpoint...
curl -s "https://www.top10lists.us/api/v1/badge/1b975c55-a33b-4d21-8998-dc2d9b2dd91d" | findstr "agent_id"

echo.
echo Testing badge verification endpoint...
curl -s "https://www.top10lists.us/api/v1/badge/1b975c55-a33b-4d21-8998-dc2d9b2dd91d/verify" | findstr "valid"

echo.
echo Testing badge image endpoint (via Vercel)...
curl -I "https://www.top10lists.us/api/v1/badge/1b975c55-a33b-4d21-8998-dc2d9b2dd91d/image" 2>&1 | findstr "Content-Type"

echo.
echo ========================================
echo ✅ DEPLOYMENT COMPLETE
echo ========================================
echo.
echo System URLs:
echo - Badge Payload: https://www.top10lists.us/api/v1/badge/AGENT_ID
echo - Badge Verify:  https://www.top10lists.us/api/v1/badge/AGENT_ID/verify
echo - Badge Image:   https://www.top10lists.us/api/v1/badge/AGENT_ID/image
echo - Stripe Webhook: https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/stripe-webhook
echo.
echo Payment Tiers:
echo - $0/month   = certified (blue badge)
echo - $50/month  = accredited (gold badge)
echo - $150/month = underwritten (yellow badge)
echo.
echo Grace Period: 3 days after payment failure
echo Cron Job: Runs daily at midnight UTC
echo.
echo ========================================
pause
