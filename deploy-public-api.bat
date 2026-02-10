@echo off
echo Deploying enrichment-api with public API endpoints...
cd C:\Edge\list-wise-boost
git pull origin main
C:\Users\rober\supabase.exe functions deploy enrichment-api --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
echo.
echo Done! Testing endpoints...
echo.
curl "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api?action=markets"
