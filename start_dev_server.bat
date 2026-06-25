@echo off
echo Starting Prompt Guard Bridge and Frontend Dev Server...
cd frontend
npm run dev 2>&1 | node c:\Users\vivek\Downloads\Promtguardextension\devserver_bridge.js
