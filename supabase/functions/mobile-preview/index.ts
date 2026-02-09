import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { chromium } from "https://deno.land/x/astral@0.4.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEVICES = [
  {
    name: 'iPhone 13',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
  },
  {
    name: 'iPhone 13 Pro Max',
    viewport: { width: 428, height: 926 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
  },
  {
    name: 'iPhone SE',
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
  },
  {
    name: 'Samsung Galaxy S21',
    viewport: { width: 360, height: 800 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    deviceScaleFactor: 3,
  },
  {
    name: 'Google Pixel 5',
    viewport: { width: 393, height: 851 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    deviceScaleFactor: 2.75,
  }
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    const targetUrl = url || 'https://staging.top10lists.us'

    console.log(`📱 Generating mobile preview for: ${targetUrl}`)

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const screenshots: Array<{ name: string; data: string; viewport: string }> = []

    for (const device of DEVICES) {
      console.log(`📸 Capturing ${device.name}...`)
      
      const context = await browser.newContext({
        viewport: device.viewport,
        userAgent: device.userAgent,
        deviceScaleFactor: device.deviceScaleFactor,
      })

      const page = await context.newPage()
      
      await page.goto(targetUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      })

      // Wait for page to settle
      await page.waitForTimeout(1000)

      // Take screenshot
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      })

      // Convert to base64
      const base64 = btoa(String.fromCharCode(...new Uint8Array(screenshot)))

      screenshots.push({
        name: device.name,
        data: base64,
        viewport: `${device.viewport.width}×${device.viewport.height} @ ${device.deviceScaleFactor}x`
      })

      await context.close()
    }

    await browser.close()

    // Generate HTML preview
    const deviceCards = screenshots.map(shot => `
      <div class="device-card">
        <div class="device-info">
          <h3>${shot.name}</h3>
          <p>${shot.viewport}</p>
        </div>
        <div class="screenshot">
          <img src="data:image/png;base64,${shot.data}" alt="${shot.name}">
        </div>
      </div>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mobile Preview: ${targetUrl}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .header {
      max-width: 1600px;
      margin: 0 auto 30px;
      background: white;
      padding: 20px 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 24px;
      margin-bottom: 10px;
      color: #333;
    }
    .url {
      color: #666;
      font-size: 14px;
      word-break: break-all;
    }
    .url a {
      color: #0066cc;
      text-decoration: none;
    }
    .url a:hover {
      text-decoration: underline;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      max-width: 1600px;
      margin: 0 auto;
    }
    .device-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .device-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .device-info {
      padding: 15px 20px;
      border-bottom: 1px solid #eee;
      background: #fafafa;
    }
    .device-info h3 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }
    .device-info p {
      font-size: 13px;
      color: #666;
    }
    .screenshot {
      padding: 20px;
      background: #fff;
      text-align: center;
    }
    .screenshot img {
      max-width: 100%;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📱 Mobile Preview</h1>
    <div class="url">URL: <a href="${targetUrl}" target="_blank">${targetUrl}</a></div>
  </div>
  <div class="grid">
    ${deviceCards}
  </div>
</body>
</html>`

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Mobile preview error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to generate mobile preview'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
