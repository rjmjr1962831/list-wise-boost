@echo off
echo ========================================
echo Merging Staging to Production
echo ========================================
echo.

echo Step 1: Aborting any stuck merge...
git merge --abort 2>&1 >> deploy-log.txt
echo.

echo Step 2: Committing current changes...
git add . 2>&1 >> deploy-log.txt
git commit -m "Update email functions and admin improvements" 2>&1 >> deploy-log.txt
echo.

echo Step 3: Switching to main branch...
git checkout main 2>&1 >> deploy-log.txt
echo.

echo Step 4: Pulling latest main...
git pull origin main 2>&1 >> deploy-log.txt
echo.

echo Step 5: Merging staging into main...
git merge staging --no-edit 2>&1 >> deploy-log.txt
echo.

echo Step 6: Pushing to main...
git push origin main 2>&1 >> deploy-log.txt
echo.

echo ========================================
echo Output saved to deploy-log.txt
echo Opening log file...
echo ========================================
notepad deploy-log.txt
pause
