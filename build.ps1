$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
Set-Location $projectRoot
& node (Join-Path $projectRoot 'scripts\run-build.cjs')
exit $LASTEXITCODE