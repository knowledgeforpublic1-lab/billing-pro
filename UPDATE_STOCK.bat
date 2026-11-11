@echo off
title Billing Pro - Stock Data Updater
echo ===================================================
echo   Billing Pro - SAP Stock Issues Database Builder
echo ===================================================
echo.
echo 1. Searching for stock.xlsx in project root and Downloads folder...
echo    Building consolidated stock database...
node scripts\build_stock_index.js
if %ERRORLEVEL% EQU 0 (
    echo.
    echo 2. Running verification tests...
    call npm test
    echo.
    echo ===================================================
    echo   [SUCCESS] Stock data has been updated successfully!
    echo   Contractor-wise issues, MRN, and Net Issues are ready.
    echo   Please refresh your browser (Ctrl+F5 or Ctrl+Shift+R).
    echo ===================================================
) else (
    echo.
    echo [ERROR] Stock update failed!
    echo Please make sure 'stock.xlsx' is in this folder or Downloads and not locked by Excel.
)
echo.
pause

