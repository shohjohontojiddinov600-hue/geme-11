@echo off
chcp 65001 > nul
echo ====================================================
echo 🚀 MYTHIC REALMS: GITHUB GA YUKLASH SKRIPTI
echo ====================================================
if "%1"=="" (
    echo Xatolik: GitHub repository URL manzili kiritilmadi!
    echo Foydalanish: GITHUB_PUSH.bat https://github.com/username/repository.git
    echo.
    set /p REPO_URL="GitHub Repository URL manzilini kiriting: "
) else (
    set REPO_URL=%1
)

if "%REPO_URL%"=="" (
    echo URL kiritilmadi. Bekor qilindi.
    pause
    exit /b 1
)

git init
git add .
git commit -m "feat: Capstone 2D Multiplayer Survival Sandbox complete release"
git branch -M main
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git push -u origin main --force

echo ====================================================
echo ✅ Muvaffaqiyatli GitHub ga yuklandi!
echo ====================================================
pause
