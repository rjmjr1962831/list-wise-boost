$content = Get-Content 'cloudflareworker.js' -Raw -Encoding UTF8

# Change to faster load strategy
$content = $content -replace 'networkidle0', 'domcontentloaded'

# Reduce all timeout values
$content = $content -replace 'timeout: 20000', 'timeout: 5000'
$content = $content -replace 'timeout: 10000', 'timeout: 3000'
$content = $content -replace 'timeout: 60000', 'timeout: 15000'

# Reduce the final buffer from 2s to 500ms
$content = $content -replace 'setTimeout\(resolve, 2000\)', 'setTimeout(resolve, 500)'

[System.IO.File]::WriteAllText("$PWD\cloudflareworker.js", $content, [System.Text.Encoding]::UTF8)

Write-Host "Optimizations applied successfully!"
