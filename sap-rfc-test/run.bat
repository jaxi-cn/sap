@echo off
REM SAP RFC test - Windows launcher
REM Usage: run.bat [table] [max_rows]

setlocal

if "%SAP_HOST%"=="" (
    echo [X] Missing SAP connection parameters
    echo    First: copy .env.example.bat .env.bat
    echo           edit .env.bat and set SAP_HOST
    echo    Then:  .env.bat
    exit /b 1
)

if not "%1"=="" set SAP_TABLE=%1
if not "%2"=="" set SAP_MAXROWS=%2

echo -> SAP: %SAP_HOST%:%SAP_PORT% client=%SAP_CLIENT%
echo -> Table: %SAP_TABLE%
echo.

python -c "import requests" 2>nul || pip install requests -q

python rfc_test.py
