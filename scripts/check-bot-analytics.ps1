# Check bot analytics pipeline: query logs, test log-bot-visit, simulate bot, re-query
# Run: .\scripts\check-bot-analytics.ps1

$envPath = Join-Path $PSScriptRoot "..\.env"
$key = $null
$svcKey = $null
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match 'VITE_SUPABASE_PUBLISHABLE_KEY=(.+)') { $key = $matches[1].Trim().Trim('"').Trim("'") }
    if ($_ -match 'SUPABASE_SERVICE_ROLE_KEY=(.+)') { $svcKey = $matches[1].Trim().Trim('"').Trim("'") }
  }
}
if (-not $key) { $key = $svcKey }
if (-not $key) {
  Write-Host "Need VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY in .env"
  exit 1
}

$base = "https://wiotrvoirdgzfacuuiem.supabase.co"
$since = (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "=== 1. Current cloudflare_request_logs (last 7 days) ==="
$h = @{ "apikey" = $key; "Authorization" = "Bearer $key"; "Prefer" = "count=exact" }
try {
  $r = Invoke-RestMethod -Uri "$base/rest/v1/cloudflare_request_logs?select=id,timestamp,bot_type&timestamp=gte.$since&order=timestamp.desc&limit=5" -Headers $h -ErrorAction Stop
  $countResp = Invoke-WebRequest -Uri "$base/rest/v1/cloudflare_request_logs?select=id&timestamp=gte.$since" -Headers @{ "apikey" = $key; "Authorization" = "Bearer $key"; "Prefer" = "count=exact" } -Method Head
  $totalCount = $countResp.Headers["Content-Range"]
  Write-Host "Count (7d): $totalCount"
  if ($r -and $r.Count -gt 0) {
    $r | ForEach-Object { Write-Host "  $($_.timestamp) | $($_.bot_type) | $($_.path)" }
  } else {
    Write-Host "  (no rows)"
  }
} catch {
  Write-Host "Error: $($_.Exception.Message)"
}

Write-Host "`n=== 2. Test log-bot-visit (direct POST) ==="
$body = @{ url = "https://www.top10lists.us/arizona/phoenix/top10realestateagents"; path = "/arizona/phoenix/top10realestateagents"; bot_type = "gptbot"; timestamp = (Get-Date -Format "o"); user_agent = "GPTBot/1.0"; method = "GET"; host = "www.top10lists.us" } | ConvertTo-Json
try {
  $logR = Invoke-RestMethod -Uri "$base/functions/v1/log-bot-visit" -Method POST -Headers @{ "Authorization" = "Bearer $key"; "Content-Type" = "application/json" } -Body $body
  Write-Host "log-bot-visit: $($logR | ConvertTo-Json -Compress)"
} catch {
  Write-Host "log-bot-visit FAILED: $($_.Exception.Message)"
}

Write-Host "`n=== 3. Simulate GPTBot request to www.top10lists.us ==="
try {
  $resp = Invoke-WebRequest -Uri "https://www.top10lists.us/arizona/phoenix/top10realestateagents" -UserAgent "Mozilla/5.0 (compatible; GPTBot/1.0)" -UseBasicParsing -TimeoutSec 90
  Write-Host "Status: $($resp.StatusCode) | X-Cache: $($resp.Headers['X-Cache'])"
} catch {
  Write-Host "Request failed: $($_.Exception.Message)"
}

Write-Host "`n=== 4. Re-query logs (after 5s for queue to process) ==="
Start-Sleep -Seconds 5
try {
  $r2 = Invoke-RestMethod -Uri "$base/rest/v1/cloudflare_request_logs?select=id,timestamp,bot_type,path,host&timestamp=gte.$since&order=timestamp.desc&limit=10" -Headers $h
  if ($r2 -and $r2.Count -gt 0) {
    $r2 | ForEach-Object { Write-Host "  $($_.timestamp) | $($_.bot_type) | $($_.path) | host=$($_.host)" }
  } else {
    Write-Host "  (still no rows - queue/consumer may not be forwarding)"
  }
} catch {
  Write-Host "Error: $($_.Exception.Message)"
}
