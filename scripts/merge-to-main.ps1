# merge-to-main.ps1
# Merges staging into main and excludes all internal documents from main.
# Run only when Robert says "push to main".
# Requires: git, npm

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

# Paths to exclude from main (internal documents)
$ExcludeListPath = Join-Path $ScriptDir "internal-documents.txt"

function Get-InternalDocumentPaths {
    if (-not (Test-Path $ExcludeListPath)) {
        Write-Error "Internal documents list not found: $ExcludeListPath"
    }
    $lines = Get-Content $ExcludeListPath | Where-Object {
        $_ -match '\S' -and -not $_.TrimStart().StartsWith('#')
    }
    return $lines | ForEach-Object { $_.Trim() }
}

function Test-ProductionBuild {
    Push-Location $RepoRoot
    try {
        $env:VITE_IS_PRODUCTION = "1"
        Write-Host "Running production build..."
        & npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Production build failed. Fix errors before merging to main."
        }
        Write-Host "Production build OK."
        # Prebuild generates public/api/faq/full.json; discard so working tree stays clean for checkout
        git checkout -- public/api/faq/full.json 2>$null
    } finally {
        Pop-Location
    }
}

function Merge-StagingToMain {
    Push-Location $RepoRoot
    try {
        # Ensure clean state
        $status = git status --porcelain
        if ($status) {
            Write-Warning "Working tree has uncommitted changes. Stash or commit them first."
            git status
            exit 1
        }

        # Fetch latest
        Write-Host "Fetching from origin..."
        git fetch origin

        # Pre-flight: production build
        Test-ProductionBuild

        # Checkout main and update
        Write-Host "Checking out main..."
        git checkout main
        git pull origin main

        # Merge staging
        Write-Host "Merging staging into main..."
        git merge staging -m "Merge staging into main"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Merge failed. Resolve conflicts and run again."
        }

        # Remove internal documents from main
        $paths = Get-InternalDocumentPaths
        $removed = @()
        foreach ($path in $paths) {
            $fullPath = Join-Path $RepoRoot $path
            $isTracked = git ls-files $path 2>$null
            if ($isTracked) {
                Write-Host "Excluding from main: $path"
                if (Test-Path $fullPath -PathType Container) {
                    git rm -r -f $path 2>$null
                } else {
                    git rm -f $path 2>$null
                }
                if ($LASTEXITCODE -eq 0) {
                    $removed += $path
                }
            }
        }

        if ($removed.Count -gt 0) {
            git commit -m "chore: exclude internal documents from main`n`nRemoved from production (staging-only): $($removed -join ', ')"
        }

        Write-Host ""
        Write-Host "Merge complete. Pushing main to origin..."
        git push origin main

        # Purge Vercel CDN and Data cache so production serves fresh content
        $envPath = Join-Path $RepoRoot ".env"
        if (Test-Path $envPath) {
            $tokenLine = Get-Content $envPath | Select-String '^VERCEL_TOKEN='
            if ($tokenLine) {
                $token = $tokenLine.ToString().Split('=', 2)[1].Trim()
                Write-Host ""
                Write-Host "Purging Vercel cache..."
                & npx vercel cache purge --yes --token $token 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Vercel cache purged."
                } else {
                    Write-Warning "Vercel cache purge failed (non-fatal)."
                }
            }
        }

        Write-Host ""
        Write-Host "Done. Main has been updated. Internal documents remain on staging only."
        Write-Host "To continue work on staging: git checkout staging"
    } finally {
        Pop-Location
    }
}

Merge-StagingToMain
