# Setup Agent Notifications Queue
# Run: .\scripts\setup-agent-notifications-queue.ps1
# Requires: npx wrangler (npm install -g wrangler or use npx)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $root

Write-Host "Creating queue: agent-notifications-queue..."
npx wrangler queues create agent-notifications-queue

if ($LASTEXITCODE -ne 0) {
  Write-Host "Queue may already exist. Continuing..."
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Add NOTIFICATION_QUEUE binding to top10-renderer in Cloudflare Dashboard:"
Write-Host "   Workers -> top10-renderer -> Settings -> Bindings -> Add Queue Producer"
Write-Host "   Queue: agent-notifications-queue, Binding: NOTIFICATION_QUEUE"
Write-Host ""
Write-Host "2. Deploy consumer: npx wrangler deploy -c wrangler.consumer.toml"
Write-Host ""
Write-Host "3. Set consumer secrets (for log-bot-visit auth):"
Write-Host "   npx wrangler secret put NOTIFICATION_AUTH_TOKEN -c wrangler.consumer.toml"
Write-Host ""

Pop-Location
