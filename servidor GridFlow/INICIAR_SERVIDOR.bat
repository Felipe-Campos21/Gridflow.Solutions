@echo off
title Ambar v2 - Servidor
cd /d "%~dp0"

echo.
echo  ========================================
echo   AMBAR v2 - SERVIDOR CENTRALIZADO
echo  ========================================
echo.
echo  Iniciando...
echo  Nao feche esta janela!
echo.

node server.js

echo.
echo  *** O servidor parou. Veja o erro acima. ***
echo.
pause
