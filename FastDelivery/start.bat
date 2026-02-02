@echo off
echo Starting local web server with CORS enabled...
echo Visit http://localhost:8080 in your browser.
http-server -p 8080 --cors
pause
