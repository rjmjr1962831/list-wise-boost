# Run generate_community_roles.py for all AZ then CA agents. Appends to existing roles (no overwrite).
# Loads .env from project root for DEEPSEEK_API_KEY and SUPABASE_SERVICE_ROLE_KEY.
# Usage: .\scripts\run_community_roles_all_batches.ps1 [BATCH_SIZE] [LOG_FILE]
#   LOG_FILE optional; when provided (e.g. by start_community_roles_background.ps1), all output goes there.
# Runs Arizona first, then California.

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$batchSize = if ($args.Count -ge 1) { [int]$args[0] } else { 25 }
$logDir = Join-Path $root "scripts\logs"
$logFile = if ($args.Count -ge 2) { $args[1] } else { Join-Path $logDir "community_roles_batches_$(Get-Date -Format 'yyyyMMdd-HHmmss').log" }
$logToFileOnly = ($args.Count -ge 2)
$states = @("arizona", "california")

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

function Write-Log { param($msg) if ($logToFileOnly) { $msg | Add-Content -Path $logFile } else { $msg | Tee-Object -FilePath $logFile -Append } }

# Load .env into env
$envPath = Join-Path $root ".env"
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $k = $matches[1].Trim()
      $v = $matches[2].Trim().Trim('"').Trim("'")
      [Environment]::SetEnvironmentVariable($k, $v, "Process")
        Set-Item -Path "Env:$k" -Value $v -ErrorAction SilentlyContinue
    }
  }
}

if (-not $env:DEEPSEEK_API_KEY) {
  Write-Error "DEEPSEEK_API_KEY not set. Add to .env or set in environment."
  exit 1
}
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
  Write-Error "SUPABASE_SERVICE_ROLE_KEY not set. Add to .env or set in environment."
  exit 1
}

Write-Log "Started at $(Get-Date -Format 'o') | batch=$batchSize | states=AZ then CA (append only)"
$totalProcessed = 0
$batchCount = 0

foreach ($state in $states) {
  $offset = 0
  Write-Log "========== STATE: $state =========="
  while ($true) {
    $batchCount++
    Write-Log "--- Batch $batchCount (offset $offset, state $state) ---"
    $out = & python (Join-Path $root "scripts\generate_community_roles.py") $batchSize $offset $state 2>&1
    Write-Log ($out | Out-String)
    if ($out -match "Got 0 agents" -or $out -match "No agents to process") {
      Write-Log "No more $state agents."
      break
    }
    if ($out -match "Done\. Success: (\d+), Errors: (\d+)") {
      $totalProcessed += [int]$matches[1]
    }
    $offset += $batchSize
  }
}

Write-Log "Finished at $(Get-Date -Format 'o') | total agents updated ~$totalProcessed | log: $logFile"
