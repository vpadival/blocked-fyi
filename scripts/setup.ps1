$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$env:UV_CACHE_DIR = Join-Path $PWD '.uv-cache'
& uv sync
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Push-Location frontend
try {
    & npm ci --cache .npm-cache --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
Write-Host 'Ready. Run scripts/run-api.ps1 and scripts/run-ui.ps1 in separate terminals.'
