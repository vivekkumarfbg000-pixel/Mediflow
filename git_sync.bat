@echo off
echo ===================================================
echo [Mediflow Sync] Starting Git Status
echo ===================================================
git status
echo.
echo ===================================================
echo [Mediflow Sync] Double check modified files above.
echo No credentials or secrets should be committed!
echo ===================================================
set /p confirm="Do you want to stage, commit, and push these changes? (y/n): "
if /i "%confirm%" neq "y" (
    echo Sync aborted by user.
    pause
    exit /b
)
echo.
echo [Mediflow Sync] Staging files...
git add .
echo [Mediflow Sync] Committing changes...
git commit -m "feat: complete production hardening audit fixes and fix auth infinite loading issues"
echo [Mediflow Sync] Pushing to GitHub (origin master)...
git push origin master
echo ===================================================
echo [Mediflow Sync] Complete!
echo ===================================================
pause
