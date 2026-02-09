# Mobile Preview Tool

Renders your site at common mobile viewport sizes and takes screenshots for visual verification.

## Usage

### Quick Commands

```bash
# Preview staging homepage
npm run preview:staging

# Preview production homepage
npm run preview:prod

# Preview any URL
npm run preview:mobile https://staging.top10lists.us/florida/agents/robert-maynard

# Preview with custom page name
node scripts/preview-mobile.js https://staging.top10lists.us/about about-page
```

## What It Does

1. **Launches headless Chromium** via Puppeteer
2. **Renders the page** at 5 common mobile viewports:
   - iPhone 13 (390x844)
   - iPhone 13 Pro Max (428x926)
   - iPhone SE (375x667)
   - Samsung Galaxy S21 (360x800)
   - Google Pixel 5 (393x851)
3. **Takes full-page screenshots** for each device
4. **Saves to** `screenshots/[page-name]/` folder
5. **Opens the folder** in Windows Explorer automatically

## Output

Screenshots are saved to:
```
screenshots/
  └── homepage/
      ├── iphone-13.png
      ├── iphone-13-pro-max.png
      ├── iphone-se.png
      ├── samsung-galaxy-s21.png
      └── pixel-5.png
```

## Use Cases

- ✅ **Verify mobile layouts** before deploying
- ✅ **Compare staging vs production** visually
- ✅ **Share mobile previews** with team/clients
- ✅ **Document UI changes** in PRs
- ✅ **Test responsive breakpoints** across devices

## Requirements

- Node.js
- Puppeteer (already installed in project)

## Notes

- Screenshots are **not committed** to git (in `.gitignore`)
- Simulates **touch events** and mobile user agents
- Captures **full page height**, not just viewport
- Waits for **network idle** before screenshot
