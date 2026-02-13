@echo off
REM Automated Knowledge Sync Script for Top10Lists.us
REM Runs UPDATE KNOWLEDGE functions for Claude and Cursor
REM No user interaction required

echo ========================================
echo Starting Knowledge Update: %date% %time%
echo ========================================

REM Change to repository directory
cd /d C:\Repository\list-wise-boost

REM ===== CLAUDE: UPDATE KNOWLEDGE =====
echo.
echo [CLAUDE] Running UPDATE KNOWLEDGE - CLAUDE - %DATE%
echo.

claude --non-interactive -y "UPDATE KNOWLEDGE - CLAUDE - %DATE%"

REM Give it a moment to complete
timeout /t 3 /nobreak > nul

REM ===== CURSOR: UPDATE KNOWLEDGE =====
echo.
echo [CURSOR] Running UPDATE KNOWLEDGE - CURSOR - %DATE%
echo.

cursor --non-interactive --dangerously-skip-permissions "UPDATE KNOWLEDGE - CURSOR - %DATE%"

echo.
echo ========================================
echo Knowledge Update Complete: %date% %time%
echo ========================================
echo.

REM Log the run
echo %date% %time% - Automated knowledge sync completed >> .knowledge\deltas\sync_log.txt

exit /b 0
