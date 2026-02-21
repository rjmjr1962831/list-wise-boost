# Start the community_roles batch job in the background. Output goes to a log file.
# Usage: .\scripts\start_community_roles_background.ps1 [BATCH_SIZE]
# The job keeps running after you close the terminal. Check scripts\logs\ for the log.

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$batchSize = if ($args.Count -ge 1) { [int]$args[0] } else { 25 }
$logDir = Join-Path $root "scripts\logs"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logDir "community_roles_batches_$timestamp.log"

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

$runnerPath = Join-Path $root "scripts\run_community_roles_all_batches.ps1"
# Create log file so runner can append (runner gets path as arg)
$null = New-Item -ItemType File -Path $logFile -Force

Write-Host "Starting community_roles batch job in background (batch=$batchSize)."
Write-Host "Log: $logFile"
Write-Host "To watch: Get-Content '$logFile' -Wait -Tail 20"

Start-Process powershell -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $runnerPath,
  [string]$batchSize,
  $logFile
) -WorkingDirectory $root -WindowStyle Hidden

Write-Host "Job started. It will keep running after you close this terminal."
