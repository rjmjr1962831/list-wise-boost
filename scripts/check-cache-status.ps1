# Probe worker cache status: request URLs as a bot and report size + X-Cache.
# Usage: .\scripts\check-cache-status.ps1

$ErrorActionPreference = "Stop"
$base = "https://www.top10lists.us"
$ua = "Googlebot/2.1 (+http://www.google.com/bot.html)"

$urls = @(
  @{ path = "/"; label = "Home"; isList = $false },
  @{ path = "/about"; label = "About"; isList = $false },
  @{ path = "/arizona"; label = "Arizona state"; isList = $false },
  @{ path = "/arizona/phoenix/top10realestateagents"; label = "Phoenix"; isList = $true },
  @{ path = "/california/los-angeles/top10realestateagents"; label = "LA"; isList = $true },
  @{ path = "/arizona/scottsdale/top10realestateagents"; label = "Scottsdale"; isList = $true },
  @{ path = "/arizona/tucson/top10realestateagents"; label = "Tucson"; isList = $true },
  @{ path = "/california/san-diego/top10realestateagents"; label = "San Diego"; isList = $true }
)

$results = @()
foreach ($u in $urls) {
  try {
    $r = Invoke-WebRequest -Uri ($base + $u.path) -Headers @{ "User-Agent" = $ua } -UseBasicParsing -TimeoutSec 25
    $cache = $r.Headers["X-Cache"]
    if (-not $cache) { $cache = "-" }
    $sizeKb = [math]::Round($r.Content.Length / 1024, 1)
    # Only list pages should have ItemList/agents; for others we expect n
    $hasList = $u.isList -and ($r.Content -match "ItemList")
    $hasAgents = $u.isList -and ($r.Content -match "RealEstateAgent|professional-card")
    $results += [PSCustomObject]@{ Label = $u.label; Status = $r.StatusCode; SizeKB = $sizeKb; Cache = $cache; ItemList = $hasList; Agents = $hasAgents }
  } catch {
    $results += [PSCustomObject]@{ Label = $u.label; Status = "ERR"; SizeKB = "-"; Cache = "-"; ItemList = $false; Agents = $false }
  }
}

# Table (List/Agents = Y only for list pages that have that content)
$results | Format-Table -AutoSize Label, Status, SizeKB, Cache, @{ N = "List"; E = { if ($_.ItemList) { "Y" } else { "n" } } }, @{ N = "Agents"; E = { if ($_.Agents) { "Y" } else { "n" } } }

# Summary
$hits = ($results | Where-Object { $_.Cache -eq "HIT" }).Count
$large = ($results | Where-Object { $_.SizeKB -is [double] -and $_.SizeKB -ge 50 }).Count
Write-Host ""
Write-Host "Summary: $hits/$($results.Count) cache HITs | $large/$($results.Count) responses >= 50 KB"
