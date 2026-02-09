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
    
    // Open the folder (Windows only)
    if (process.platform === 'win32') {
      const { exec } = await import('child_process');
      exec(`explorer "${screenshotsDir}"`);
      console.log(`📂 Opened screenshots folder in Explorer\n`);
    }

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
