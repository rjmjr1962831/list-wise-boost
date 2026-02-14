@echo off
REM Automated Sync Script for Top10Lists.us
REM Runs 21:00 and 06:00 knowledge update functions
REM No user interaction required

echo ========================================
echo Starting Automated Updates: %date% %time%
echo ========================================

REM Change to repository directory
cd /d C:\Repository\list-wise-boost

REM ===== 21:00 UPDATE: Evening Knowledge Sync =====
echo.
echo [21:00 Function] Running Evening Knowledge Update...
echo.

REM Claude: UPDATE KNOWLEDGE function
echo Running Claude UPDATE KNOWLEDGE - CLAUDE - %DATE%...
claude -y "UPDATE KNOWLEDGE - CLAUDE - %DATE%"

timeout /t 3 /nobreak > nul

REM Cursor: UPDATE KNOWLEDGE function
echo Running Cursor UPDATE KNOWLEDGE - CURSOR - %DATE%...
cursor --print --force "UPDATE KNOWLEDGE - CURSOR - %DATE%"

timeout /t 3 /nobreak > nul

REM Sync daily takeaways to docs
echo Syncing daily takeaways...
npm run takeaways:sync

REM ===== 06:00 UPDATE: Morning Cache Warm =====
echo.
echo [06:00 Function] Running Morning Cache Warm...
echo.

REM Warm top markets cache
echo Warming top markets cache...
npx supabase functions invoke warm-top-markets --project-ref wiotrvoirdgzfacuuiem

REM Optional: Run a quick bot analytics check
echo Checking bot analytics...
cursor --print --force "Quick summary: Check cloudflare_request_logs for overnight bot activity and cache hit rates"

echo.
echo ========================================
echo Updates Complete: %date% %time%
echo ========================================
echo.

REM Log the run
echo %date% %time% - Automated sync completed (21:00 + 06:00 functions) >> .knowledge\deltas\sync_log.txt

exit /b 0
