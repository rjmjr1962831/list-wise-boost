@echo off
REM Deploy API Edge Functions to Supabase

echo Deploying agents-search function...
C:\Users\rober\supabase.exe functions deploy agents-search --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt

echo.
echo Deploying agent-details function...
C:\Users\rober\supabase.exe functions deploy agent-details --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt

echo.
echo Deploying markets function...
C:\Users\rober\supabase.exe functions deploy markets --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt

echo.
echo All functions deployed!
echo.
echo Test endpoints:
echo https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/agents-search?city=Scottsdale
echo https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/agent-details?id=5289
echo https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/markets
