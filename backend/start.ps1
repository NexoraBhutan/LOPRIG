# Starts the Lop-rig backend: database (Docker) + Django API, and optionally opens Django Admin.
#   npm run backend   -> start everything
#   npm run admin     -> start everything and open http://localhost:8000/admin/
param([switch]$OpenAdmin)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Starting database..." -ForegroundColor Yellow
docker compose -p loprig up -d --wait
if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not start the database. Is Docker Desktop open?" -ForegroundColor Red
    exit 1
}

$running = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($OpenAdmin) { Start-Process "http://localhost:8000/admin/" }

if ($running) {
    Write-Host "API is already running on http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "Starting API on http://localhost:8000 (Ctrl+C to stop)" -ForegroundColor Green
    & .\.venv\Scripts\python.exe manage.py runserver 8000
}
