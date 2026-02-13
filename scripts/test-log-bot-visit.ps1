# Test log-bot-visit endpoint (Notification Queue verification)
# Run: .\scripts\test-log-bot-visit.ps1

$url = "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/log-bot-visit"
$anonKey = $env:VITE_SUPABASE_PUBLISHABLE_KEY
if (-not $anonKey) {
  $envPath = Join-Path $PSScriptRoot "..\.env"
  if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
      if ($_ -match 'VITE_SUPABASE_PUBLISHABLE_KEY="(.+)"') { $anonKey = $matches[1] }
    }
  }
}
if (-not $anonKey) {
  Write-Host "Set VITE_SUPABASE_PUBLISHABLE_KEY or add to .env"
  exit 1
}

$headers = @{
  "Authorization" = "Bearer $anonKey"
  "Content-Type" = "application/json"
}
$body = @{
  url = "https://www.top10lists.us/arizona/phoenix/top10realestateagents"
  path = "/arizona/phoenix/top10realestateagents"
  bot_type = "gptbot"
  timestamp = (Get-Date -Format "o")
  user_agent = "GPTBot/1.0"
  method = "GET"
} | ConvertTo-Json

Write-Host "Testing log-bot-visit endpoint..."
try {
  $r = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
  Write-Host "SUCCESS: $($r | ConvertTo-Json -Compress)"
} catch {
  Write-Host "FAILED: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    Write-Host $reader.ReadToEnd()
  }
  exit 1
}
