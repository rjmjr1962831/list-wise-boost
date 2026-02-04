# This script uses curl instead of PowerShell Invoke-RestMethod for large files
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$workerPath = Join-Path $root "cloudflareworker.js"
$tempJsonPath = Join-Path $root "worker-upload.json"
$outputPath = Join-Path $root "update-worker.json"

if (-not (Test-Path $workerPath)) {
  Write-Error "Worker file not found: $workerPath"
}

Write-Host "Reading worker script..."
$workerScript = Get-Content -Raw $workerPath

Write-Host "Building JSON payload..."
# Build JSON manually to avoid PowerShell conversion issues
$escapedScript = $workerScript -replace '\\', '\\' -replace '"', '\"' -replace "`r`n", '\n' -replace "`n", '\n'
$json = "{`"scriptName`":`"top10-renderer`",`"scriptContent`":`"$escapedScript`"}"

Write-Host "Writing to temp file..."
$json | Out-File -Encoding utf8 -NoNewline $tempJsonPath

Write-Host "Uploading to Cloudflare via Supabase function..."
curl.exe -s -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/update-cloudflare-worker" -H "Content-Type: application/json" -d "@$tempJsonPath" -o $outputPath

Write-Host "Saved response to $outputPath"
Remove-Item $tempJsonPath
