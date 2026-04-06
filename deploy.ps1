$ErrorActionPreference = "Stop"

Write-Host "Planning handmatige deploy helper" -ForegroundColor Cyan
Write-Host "Stap 1/2: build starten..." -ForegroundColor Yellow

& node (Join-Path $PSScriptRoot 'scripts\run-build.cjs')

if ($LASTEXITCODE -ne 0) {
  throw "Build mislukt. Deploy gestopt."
}

$distPath = Join-Path $PSScriptRoot "dist"

if (!(Test-Path $distPath)) {
  throw "Map 'dist' niet gevonden. Deploy gestopt."
}

Write-Host "Stap 2/2: dist-map openen..." -ForegroundColor Yellow
Start-Process explorer.exe $distPath

Write-Host "Klaar. De actuele build-output staat in 'dist'." -ForegroundColor Green
