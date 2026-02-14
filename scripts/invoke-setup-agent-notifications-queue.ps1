# Invoke setup-agent-notifications-queue (no wrangler, ARM64-friendly)
# Run after: npx supabase functions deploy setup-agent-notifications-queue --project-ref wiotrvoirdgzfacuuiem

$url = "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/setup-agent-notifications-queue"
$anonKey = $env:SUPABASE_ANON_KEY
if (-not $anonKey) {
  Write-Host "Set SUPABASE_ANON_KEY or pass -Headers @{Authorization='Bearer YOUR_ANON_KEY'}"
  $anonKey = "YOUR_ANON_KEY"
}
$headers = @{
  "Authorization" = "Bearer $anonKey"
  "Content-Type" = "application/json"
}
Write-Host "Invoking setup-agent-notifications-queue..."
$r = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body "{}"
$r | ConvertTo-Json -Depth 5
