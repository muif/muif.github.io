@echo off
echo Starting local web server with CORS enabled...
echo Visit http://localhost:8090 in your browser.
http-server -p 8090 --cors
pause
