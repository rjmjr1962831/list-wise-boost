@echo off
echo ========================================
echo Deploying Fixed Stripe Webhook
echo ========================================
echo.

cd C:\Edge\list-wise-boost

echo Pulling latest code from GitHub...
git pull

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Git pull failed - trying to clone fresh...
    cd C:\Edge
    if exist list-wise-boost rmdir /S /Q list-wise-boost
    git clone https://github.com/rjmjr1962831/list-wise-boost.git
    cd list-wise-boost
)

echo.
echo Deploying stripe-webhook function...
C:\Users\rober\supabase.exe functions deploy stripe-webhook --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Deployment failed
    pause
    exit /b 1
)

echo.
echo ✅ Webhook deployed successfully
echo.
echo ========================================
echo Testing the Fixed Webhook
echo ========================================
echo.

echo Creating test payment ($50 - accredited tier)...
echo.

curl -s -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/stripe-webhook" ^
  -H "Content-Type: application/json" ^
  -d "{\"type\":\"invoice.paid\",\"data\":{\"object\":{\"customer_email\":\"allisoncahillslp@gmail.com\",\"amount_paid\":5000}}}"

echo.
echo.
echo Waiting 3 seconds for processing...
timeout /t 3 /nobreak > nul

echo.
echo Checking if tier was updated...
curl -s -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api?action=query" ^
  -H "X-Enrichment-Key: t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a" ^
  -H "Content-Type: application/json" ^
  -d "{\"table\":\"professionals\",\"select\":\"name,badge_tier,badge_status,last_payment_at,monthly_revenue_cents\",\"filters\":[{\"field\":\"email\",\"operator\":\"eq\",\"value\":\"allisoncahillslp@gmail.com\"}],\"limit\":1}"

echo.
echo.
echo ========================================
echo Testing Badge Image Update
echo ========================================
echo.

echo Downloading badge (should be GOLD if webhook worked)...
curl -s "https://www.top10lists.us/api/v1/badge/kfp7Vg/image" -o "%TEMP%\badge-test.png"

if exist "%TEMP%\badge-test.png" (
    echo ✅ Badge downloaded
    echo Opening badge image...
    start "" "%TEMP%\badge-test.png"
    echo.
    echo If the badge is GOLD (not blue), the webhook is working!
) else (
    echo ❌ Badge download failed
)

echo.
echo ========================================
echo Testing Payment Failure
echo ========================================
echo.

echo Simulating payment failure (3-day grace period)...
curl -s -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/stripe-webhook" ^
  -H "Content-Type: application/json" ^
  -d "{\"type\":\"invoice.payment_failed\",\"data\":{\"object\":{\"customer_email\":\"allisoncahillslp@gmail.com\"}}}"

echo.
timeout /t 3 /nobreak > nul

echo Checking grace period status...
curl -s -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api?action=query" ^
  -H "X-Enrichment-Key: t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a" ^
  -H "Content-Type: application/json" ^
  -d "{\"table\":\"professionals\",\"select\":\"badge_status,payment_failed_at,grace_period_ends_at\",\"filters\":[{\"field\":\"email\",\"operator\":\"eq\",\"value\":\"allisoncahillslp@gmail.com\"}],\"limit\":1}"

echo.
echo.
echo ========================================
echo Deployment Complete
echo ========================================
echo.
echo Check the results above:
echo 1. badge_tier should be "accredited" (was certified)
echo 2. badge_status should be "grace_period" (was active)
echo 3. Badge image should be GOLD
echo.
echo If all three are correct, the webhook is working!
echo.
pause
