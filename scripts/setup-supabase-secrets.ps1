# Add Cloudflare credentials to Supabase secrets
# These are needed for the cloudflare-logpull function

$ZONE_ID = "8fa4d64b0f14a514fd13d5a67e51b75a"
$API_TOKEN = "CvIdaJllKSIhhC8YyFHQIyC0JMqPK56bNb6MTa3O"

Write-Host "Setting Supabase secrets for Cloudflare Logpull..." -ForegroundColor Green

# Set the secrets via Supabase dashboard API
$PROJECT_REF = "wiotrvoirdgzfacuuiem"
$SUPABASE_ACCESS_TOKEN = Read-Host "Enter your Supabase access token (from https://supabase.com/dashboard/account/tokens)"

$secrets = @{
    "CLOUDFLARE_ZONE_ID" = $ZONE_ID
    "CLOUDFLARE_API_TOKEN" = $API_TOKEN
}

foreach ($key in $secrets.Keys) {
    Write-Host "`nSetting secret: $key" -ForegroundColor Cyan
    
    $body = @{
        name = $key
        value = $secrets[$key]
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod `
            -Uri "https://api.supabase.com/v1/projects/$PROJECT_REF/secrets" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $SUPABASE_ACCESS_TOKEN"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        Write-Host "✅ Set $key" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to set $key : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n✅ Secrets configured! Edge Function will use these credentials." -ForegroundColor Green
