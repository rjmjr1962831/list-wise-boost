# Setup Cloudflare Logpush via API
# This script creates a Logpush job to send HTTP request logs to Supabase

# SETUP: Configured for top10lists.us
$CLOUDFLARE_ZONE_ID = "8fa4d64b0f14a514fd13d5a67e51b75a"
$CLOUDFLARE_API_TOKEN = "CvIdaJllKSIhhC8YyFHQIyC0JMqPK56bNb6MTa3O"

# Supabase endpoint (already deployed)
$SUPABASE_ENDPOINT = "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/cloudflare-logpush"
$LOGPUSH_SECRET = "t10l_logpush_2026"

# Add secret to destination URL
$DESTINATION_WITH_SECRET = "${SUPABASE_ENDPOINT}?secret=${LOGPUSH_SECRET}"

# Fields to include in logs
$FIELDS = "ClientIP,ClientRequestUserAgent,ClientRequestURI,ClientRequestHost,ClientRequestMethod,EdgeStartTimestamp,RayID,ClientCountry,CacheResponseStatus,EdgeResponseStatus"

Write-Host "Creating Cloudflare Logpush job..." -ForegroundColor Green

$body = @{
    name = "top10lists-bot-analytics"
    destination_conf = $DESTINATION_WITH_SECRET
    dataset = "http_requests"
    frequency = "high"
    enabled = $true
    logpull_options = "fields=$FIELDS&timestamps=rfc3339"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/logpush/jobs" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $CLOUDFLARE_API_TOKEN"
            "Content-Type" = "application/json"
        } `
        -Body $body
    
    if ($response.success) {
        Write-Host "✅ Logpush job created successfully!" -ForegroundColor Green
        Write-Host "Job ID: $($response.result.id)" -ForegroundColor Cyan
        Write-Host "`nLogs will start flowing to Supabase within a few minutes." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Error creating job:" -ForegroundColor Red
        Write-Host ($response.errors | ConvertTo-Json -Depth 10)
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get detailed error from response
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "`nDetailed error:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
}
