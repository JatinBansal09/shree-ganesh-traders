@echo off
echo.
echo ==========================================
echo   SGT — Local Error Checks
echo ==========================================
echo.

call D:\Freelancing_Projects\Shree_Ganesh_Traders\shree_ganesh_env\Scripts\activate.bat
cd D:\Freelancing_Projects\Shree_Ganesh_Traders\my-app\backend

echo [1/4] Flake8 — syntax and style...
flake8 base/ --max-line-length=120 --exclude=migrations/
if %errorlevel% neq 0 (
    echo ❌ Flake8 found issues.
) else (
    echo ✅ Flake8 passed.
)

echo.
echo [2/4] Bandit — security scan...
bandit -r base/ -ll --exclude base/migrations
if %errorlevel% neq 0 (
    echo ❌ Bandit found issues.
) else (
    echo ✅ Bandit passed.
)

echo.
echo [3/4] Django system check...
python manage.py check
if %errorlevel% neq 0 (
    echo ❌ Django check failed.
) else (
    echo ✅ Django check passed.
)

echo.
echo [4/4] Missing migrations check...
python manage.py makemigrations --check --dry-run
if %errorlevel% neq 0 (
    echo ❌ Missing migrations found.
) else (
    echo ✅ Migrations up to date.
)

echo.
echo ==========================================
echo   Done. Review results above.
echo ==========================================
pause