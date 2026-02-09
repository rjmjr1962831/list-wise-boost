#!/usr/bin/env node

/**
 * Mobile Preview Tool
 * 
 * Renders a page at common mobile viewport sizes and takes screenshots
 * Usage: node scripts/preview-mobile.js [url] [page-name]
 * Example: node scripts/preview-mobile.js https://staging.top10lists.us homepage
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common mobile viewports
const DEVICES = [
  {
    name: 'iphone-13',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'iphone-13-pro-max',
    viewport: { width: 428, height: 926 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'iphone-se',
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'samsung-galaxy-s21',
    viewport: { width: 360, height: 800 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'pixel-5',
    viewport: { width: 393, height: 851 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
  }
];

async function generatePreviewHTML(screenshotsDir, url, pageName, devices) {
  const htmlPath = path.join(screenshotsDir, 'index.html');
  
  const deviceCards = devices.map(device => {
    const imgPath = `./${device.name}.png`;
    return `
      <div class="device-card">
        <div class="device-info">
          <h3>${device.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</h3>
          <p>${device.viewport.width}×${device.viewport.height} @ ${device.deviceScaleFactor}x</p>
        </div>
        <div class="screenshot">
          <img src="${imgPath}" alt="${device.name}" loading="lazy">
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mobile Preview: ${pageName}</title>
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
    <h1>📱 Mobile Preview: ${pageName}</h1>
    <div class="url">URL: <a href="${url}" target="_blank">${url}</a></div>
  </div>
  <div class="grid">
    ${deviceCards}
  </div>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf-8');
  return htmlPath;
}

async function previewMobile(url, pageName = 'preview') {
  console.log(`\n📱 Mobile Preview Tool\n`);
  console.log(`URL: ${url}`);
  console.log(`Page: ${pageName}\n`);

  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', pageName);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true
  });

  try {
    for (const device of DEVICES) {
      console.log(`\n📸 Capturing ${device.name} (${device.viewport.width}x${device.viewport.height})...`);
      
      const context = await browser.newContext({
        viewport: device.viewport,
        userAgent: device.userAgent,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile,
        hasTouch: device.hasTouch,
      });

      const page = await context.newPage();
      
      // Navigate to page
      console.log(`   Loading page...`);
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait a bit for any animations/lazy loading
      await page.waitForTimeout(1000);

      // Take full page screenshot
      const screenshotPath = path.join(screenshotsDir, `${device.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      console.log(`   ✅ Saved: ${screenshotPath}`);

      // Get page metrics
      const metrics = await page.evaluate(() => {
        return {
          documentHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          title: document.title,
          h1: document.querySelector('h1')?.textContent?.substring(0, 80)
        };
      });

      console.log(`   Title: ${metrics.title}`);
      console.log(`   H1: ${metrics.h1}...`);
      console.log(`   Height: ${metrics.documentHeight}px`);

      await context.close();
    }

    console.log(`\n✅ All screenshots saved to: ${screenshotsDir}\n`);
    
    // Generate HTML preview page
    console.log('Generating preview page...');
    const htmlPath = await generatePreviewHTML(screenshotsDir, url, pageName, DEVICES);
    console.log(`✅ Preview page: ${htmlPath}\n`);
    
    // Open the HTML preview in browser
    const { exec } = await import('child_process');
    const command = process.platform === 'win32' 
      ? `start "" "${htmlPath}"`
      : process.platform === 'darwin'
      ? `open "${htmlPath}"`
      : `xdg-open "${htmlPath}"`;
    
    exec(command);
    console.log(`🌐 Opening preview in browser...\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const url = args[0] || 'https://staging.top10lists.us';
const pageName = args[1] || new URL(url).pathname.replace(/\//g, '-').replace(/^-+|-+$/g, '') || 'homepage';

// Run
previewMobile(url, pageName)
  .then(() => {
    console.log('Done! 🎉\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
