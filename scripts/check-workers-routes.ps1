# Check Cloudflare Workers routes for the zone. Ensures top10-renderer is in front of www.top10lists.us.
# Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID (or CLOUDFLARE_ACCOUNT_ID for fallback)
# Usage: .\scripts\check-workers-routes.ps1

$ErrorActionPreference = "Stop"
$token = $env:CLOUDFLARE_API_TOKEN
$zoneId = $env:CLOUDFLARE_ZONE_ID

if (-not $token) {
  Write-Error "CLOUDFLARE_API_TOKEN not set"
  exit 1
}
if (-not $zoneId) {
  # Fallback from known config
  $zoneId = "8fa4d64b0f14a514fd13d5a67e51b75a"
}

$uri = "https://api.cloudflare.com/client/v4/zones/$zoneId/workers/routes"
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

try {
  $r = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
  if (-not $r.success) {
    Write-Error "API error: $($r | ConvertTo-Json -Compress)"
    exit 1
  }
  $routes = $r.result
  Write-Host "Workers routes for zone $zoneId`:"
  $routes | ForEach-Object { Write-Host "  pattern: $($_.pattern) -> script: $($_.script)" }
  $top10 = $routes | Where-Object { $_.script -eq "top10-renderer" }
  if ($top10) {
    Write-Host ""
    Write-Host "top10-renderer is attached to: $($top10.pattern -join ', ')"
  } else {
    Write-Host ""
    Write-Host "WARNING: top10-renderer is NOT in Workers routes. Add route: *top10lists.us/* or www.top10lists.us/*"
    exit 1
  }
} catch {
  Write-Error $_
  exit 1
}
