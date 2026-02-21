# Purge worker cache, then re-warm with static pages + major cities (200k+ population) only.
# Requires: SUPABASE_SERVICE_ROLE_KEY in env or in project root .env (gitignored).
# Usage: .\scripts\purge-and-warm-static-major-cities.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$baseUrl = "https://wiotrvoirdgzfacuuiem.supabase.co"

# Load .env from project root if key not already set
$serviceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $serviceRoleKey) {
  $envPath = Join-Path $root ".env"
  if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
      if ($_ -match '^\s*SUPABASE_SERVICE_ROLE_KEY=(.+)$') { $serviceRoleKey = $matches[1].Trim() }
    }
  }
}
if (-not $serviceRoleKey) {
  Write-Error "SUPABASE_SERVICE_ROLE_KEY not set. Set it in env or add to project root .env"
  exit 1
}

$headers = @{
  "Content-Type" = "application/json"
  "Authorization" = "Bearer $serviceRoleKey"
}

Write-Host "Step 1: Purging worker cache (all URLs from warm-cache list)..."
try {
  $purgeResp = Invoke-RestMethod -Uri "$baseUrl/functions/v1/purge-worker-cache" -Method POST -Headers $headers -Body "{}" -TimeoutSec 120
  Write-Host "Purge result: $($purgeResp | ConvertTo-Json -Compress)"
  $purged = $purgeResp.purged
  Write-Host "Purged $purged URLs from worker cache."
} catch {
  Write-Error "Purge failed: $_"
  exit 1
}

Write-Host "Step 2: Starting re-warm in background (static pages + major cities 200k+ pop)..."
$warmBody = @{
  forceRefresh = $true
  includeCities = $true
  includeNeighborhoods = $false
  majorCitiesOnly = $true
  concurrency = 5
  background = $true
} | ConvertTo-Json

try {
  $warmResp = Invoke-RestMethod -Uri "$baseUrl/functions/v1/warm-cache" -Method POST -Headers $headers -Body $warmBody -TimeoutSec 60
  Write-Host $warmResp.message
  Write-Host "Job ID: $($warmResp.job_id). Pages: $($warmResp.pages.total) total ($($warmResp.pages.static) static, $($warmResp.pages.cities) major cities)."
} catch {
  Write-Error "Warm start failed: $_"
  exit 1
}

Write-Host "Done. Cache purged; warm job running in background. Check Supabase function logs for completion."
