# Apply host column migration via Supabase Management API
# Requires: SUPABASE_ACCESS_TOKEN in env or .env (from https://supabase.com/dashboard/account/tokens)
# Run: .\scripts\apply-host-column-migration.ps1

$envPath = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match 'SUPABASE_ACCESS_TOKEN=(.+)') { $env:SUPABASE_ACCESS_TOKEN = $matches[1].Trim().Trim('"').Trim("'") }
  }
}
if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Set SUPABASE_ACCESS_TOKEN (from https://supabase.com/dashboard/account/tokens)"
  Write-Host "Or run the SQL manually in Supabase SQL Editor:"
  Write-Host "  https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/sql/new"
  Get-Content (Join-Path $PSScriptRoot "apply-host-column.sql") | Write-Host
  exit 1
}

$sql = "ALTER TABLE public.cloudflare_request_logs ADD COLUMN IF NOT EXISTS host text;"
$body = @{ query = $sql; name = "add_host_column_bot_logs" } | ConvertTo-Json
try {
  $r = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/wiotrvoirdgzfacuuiem/database/migrations" `
    -Method POST -Headers @{
      "Authorization" = "Bearer $env:SUPABASE_ACCESS_TOKEN"
      "Content-Type" = "application/json"
    } -Body $body -TimeoutSec 30
  Write-Host "Migration applied successfully"
} catch {
  Write-Host "API failed (may need partner access). Run SQL manually in Dashboard:"
  Write-Host "  https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/sql/new"
  Write-Host $sql
  Write-Host "Error: $($_.Exception.Message)"
  exit 1
}
