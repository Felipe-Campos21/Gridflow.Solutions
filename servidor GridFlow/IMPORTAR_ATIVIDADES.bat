@echo off
title Importar Atividades - GridFlow
color 0A
echo.
echo ============================================
echo   IMPORTADOR DE ATIVIDADES - GRIDFLOW
echo ============================================
echo.
echo OPCAO 1 - Servidor local (localhost:5000)
echo   Deixe CONTA_ID e RENDER_URL em branco
echo   e rode com o servidor local ligado.
echo.
echo OPCAO 2 - Servidor Render (producao)
echo   Defina as variaveis antes de rodar:
echo   set CONTA_ID=SEU_CONTA_ID
echo   set RENDER_URL=seu-app.onrender.com
echo.
pause
echo.
echo Iniciando importacao das atividades...
echo.
node importar-atividades.js
echo.
echo ============================================
echo   Importacao concluida!
echo ============================================
echo.
pause
