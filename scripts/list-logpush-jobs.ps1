# List existing Cloudflare Logpush jobs

$CLOUDFLARE_ZONE_ID = "8fa4d64b0f14a514fd13d5a67e51b75a"
$CLOUDFLARE_API_TOKEN = "CvIdaJllKSIhhC8YyFHQIyC0JMqPK56bNb6MTa3O"

Write-Host "Fetching existing Logpush jobs..." -ForegroundColor Green

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/logpush/jobs" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $CLOUDFLARE_API_TOKEN"
            "Content-Type" = "application/json"
        }
    
    if ($response.success) {
        $jobs = $response.result
        Write-Host "`n✅ Found $($jobs.Count) Logpush job(s):`n" -ForegroundColor Green
        
        foreach ($job in $jobs) {
            Write-Host "Job ID: $($job.id)" -ForegroundColor Cyan
            Write-Host "  Name: $($job.name)"
            Write-Host "  Dataset: $($job.dataset)"
            Write-Host "  Destination: $($job.destination_conf)"
            Write-Host "  Enabled: $($job.enabled)"
            Write-Host "  Frequency: $($job.frequency)"
            Write-Host ""
        }
    } else {
        Write-Host "❌ Error:" -ForegroundColor Red
        Write-Host ($response.errors | ConvertTo-Json -Depth 10)
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}
