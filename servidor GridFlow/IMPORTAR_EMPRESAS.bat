@echo off
title Importar Empresas - Ambar v2
color 0A
echo.
echo ============================================
echo   IMPORTADOR DE EMPRESAS - AMBAR v2
echo ============================================
echo.
echo ATENCAO: O servidor deve estar rodando!
echo (Abra INICIAR_SERVIDOR.bat antes de continuar)
echo.
pause
echo.
echo Iniciando importacao das empresas...
echo.
node importar-empresas.js
echo.
echo ============================================
echo   Importacao concluida!
echo ============================================
echo.
pause
