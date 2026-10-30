@echo off
title Billing Pro - Stock Data Updater
echo ===================================================
echo   Billing Pro - SAP Stock Issues Database Builder
echo ===================================================
echo.
echo 1. Reading stock.xlsx and building consolidated stock database...
node scripts\build_stock_index.js
if %ERRORLEVEL% EQU 0 (
    echo.
    echo 2. Running verification tests...
    npm test
    echo.
    echo ===================================================
    echo   [SUCCESS] Stock data has been updated!
    echo   Contractor-wise issues, MRN, and Net Issues are ready.
    echo ===================================================
) else (
    echo.
    echo [ERROR] Stock update failed!
    echo Please make sure 'stock.xlsx' is in this folder and not locked by Excel.
)
echo.
pause
