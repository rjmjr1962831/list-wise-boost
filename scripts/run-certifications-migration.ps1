# Copy certifications migration SQL to clipboard for Supabase SQL Editor

$sqlFile = "C:\Repository\list-wise-boost\supabase\migrations\20260208_certifications.sql"

if (Test-Path $sqlFile) {
    Get-Content $sqlFile -Raw | Set-Clipboard
    Write-Host "Success: SQL copied to clipboard!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/sql/new" -ForegroundColor Cyan
    Write-Host "2. Paste (Ctrl+V) the SQL" -ForegroundColor Cyan
    Write-Host "3. Click Run button" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This will create the certifications table for the artifact system." -ForegroundColor White
} else {
    Write-Host "Error: SQL file not found" -ForegroundColor Red
}
