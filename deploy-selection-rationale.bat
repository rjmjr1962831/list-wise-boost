@echo off
REM Deploy selection_rationale enrichment Edge Function

echo Setting DeepSeek API key as secret...
C:\Users\rober\supabase.exe secrets set DEEPSEEK_API_KEY=sk-7fba7f66337d4108bfceeee4151e8b8f --project-ref wiotrvoirdgzfacuuiem

echo.
echo Deploying enrich-selection-rationale function...
C:\Users\rober\supabase.exe functions deploy enrich-selection-rationale --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt

echo.
echo Deployment complete!
echo.
echo To trigger the enrichment:
echo curl -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrich-selection-rationale" -H "X-Enrichment-Key: t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a"
echo.
pause
