# GA4 Conversion Goals Setup Guide

This guide will help you configure conversion goals in Google Analytics 4 for Top10Lists.us high-value actions.

## Overview

Conversion tracking helps measure the success of your professional listings by tracking when users take important actions like contacting agents or viewing their profiles.

---

## Recommended Conversions

Based on your business goals, these events should be marked as conversions:

### 🎯 Primary Conversions (High Value)

1. **`contact_cta_click`** - User clicks phone or website to contact agent
   - **Value:** Direct lead generation
   - **Why:** Shows intent to engage with professional

2. **`agent_profile_click`** - User visits agent's external website
   - **Value:** Referral traffic to professionals
   - **Why:** Indicates strong interest in specific agent

### 📊 Secondary Conversions (Medium Value)

3. **`agent_card_expand`** - User expands a section to see more agents
   - **Value:** Content engagement
   - **Why:** Shows user is actively browsing listings

4. **`scroll_depth`** - User scrolls 75% down the page
   - **Value:** Page engagement
   - **Why:** Indicates quality content consumption

### 🔍 Micro Conversions (Supporting Metrics)

5. **`badge_hover`** - User hovers over verification badge
   - **Value:** Trust signal engagement
   - **Why:** User is evaluating credibility

---

## Step-by-Step Setup in GA4

### Step 1: Access GA4 Admin Panel

1. Go to [analytics.google.com](https://analytics.google.com)
2. Select your property (G-VW0TD1TTTK)
3. Click **Admin** (gear icon in bottom left)
4. Under **Data display**, click **Events**

### Step 2: Verify Events Are Appearing

Before marking events as conversions, verify they're being received:

1. In GA4, go to **Reports** → **Engagement** → **Events**
2. Wait 24-48 hours for events to appear (or use DebugView for real-time)
3. Look for these event names:
   - `contact_cta_click`
   - `agent_profile_click`
   - `agent_card_expand`
   - `scroll_depth`
   - `badge_hover`

### Step 3: Mark Events as Conversions

For each high-value event:

1. Go to **Admin** → **Events**
2. Find the event name in the list
3. Toggle the **Mark as conversion** switch to ON
4. Click **Save**

**Recommended order:**
1. ✅ Mark `contact_cta_click` as conversion first
2. ✅ Mark `agent_profile_click` as conversion second
3. ⚠️ Consider marking `agent_card_expand` (optional)
4. ⚠️ Consider marking `scroll_depth` (optional)

### Step 4: Set Conversion Values (Optional)

You can assign monetary values to conversions:

1. Go to **Admin** → **Events**
2. Click on the event name
3. Click **Edit event**
4. Add parameter: `value` with a number
5. Click **Save**

**Suggested values:**
- `contact_cta_click`: $10-50 (estimated lead value)
- `agent_profile_click`: $5-20 (estimated referral value)
- `agent_card_expand`: $1-5 (engagement value)

---

## Using DebugView for Testing

Before going live, test your conversions in DebugView:

### Enable Debug Mode

1. In your browser, add this to the URL: `?debug_mode=true`
2. Or install [Google Analytics Debugger extension](https://chrome.google.com/webstore)

### View Real-Time Events

1. In GA4, go to **Admin** → **DebugView**
2. Select your device/browser
3. Perform actions on your site (click phone, website, etc.)
4. Watch events appear in real-time
5. Verify parameters are correct

---

## Conversion Reporting

Once conversions are set up, you can track them:

### Standard Reports

1. **Reports** → **Engagement** → **Conversions**
   - See all conversion events and counts
   - Compare conversion rates over time

2. **Reports** → **Monetization** → **Ecommerce purchases**
   - See conversion values (if configured)

### Custom Reports

Create a custom report for professional listing conversions:

1. Go to **Explore** in left menu
2. Click **Blank** to create new exploration
3. Add these dimensions:
   - `Event name`
   - `agent_name` (custom parameter)
   - `agent_type` (custom parameter)
   - `market` (custom parameter)
4. Add these metrics:
   - `Event count`
   - `Conversions`
   - `Total revenue` (if values set)

---

## Google Ads Integration

If you're running Google Ads, import these conversions:

1. In GA4 **Admin** → **Product links** → **Google Ads links**
2. Link your Google Ads account
3. Go to Google Ads → **Goals** → **Conversions**
4. Click **Import** → Select **Google Analytics 4**
5. Choose conversions to import:
   - ✅ `contact_cta_click`
   - ✅ `agent_profile_click`
6. Click **Import and continue**

**Note:** Your site already has Google Ads tag (AW-16786179175) configured!

---

## Tracking ROI for Professionals

To measure value for listed professionals:

### By Agent Performance

Custom report showing which agents get the most conversions:

**Dimensions:**
- `agent_name`
- `agent_type`
- `market`

**Metrics:**
- `contact_cta_click` count
- `agent_profile_click` count
- Conversion rate

### By Agent Type

Compare "Established" vs "Hungry" agent performance:

**Dimensions:**
- `agent_type`

**Metrics:**
- Total conversions
- Conversion rate
- Average time on page

---

## Event Parameter Reference

All our events include these parameters for detailed analysis:

### Standard Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `agent_name` | Professional's name | "Ashley Pickens" |
| `agent_type` | Category of agent | "Established", "Hungry", "Dentist" |
| `market` | Geographic market | "Gilbert, AZ" |

### Event-Specific Parameters

| Event | Additional Parameters |
|-------|---------------------|
| `agent_profile_click` | `destination_url` |
| `badge_hover` | `badge_type` |
| `scroll_depth` | `percent_scrolled`, `page_path` |

---

## Conversion Optimization Tips

### Increase Conversion Rates

1. **A/B Test CTAs**: Test different phone/website link text
2. **Badge Placement**: Track which badge types get most hovers
3. **Section Order**: Test "Established" vs "Hungry" section order
4. **Mobile Optimization**: Ensure phone links work seamlessly on mobile

### Track Attribution

Create audiences based on conversions:

1. **Admin** → **Audience**
2. Create audience: "Users who contacted agents"
3. Condition: `contact_cta_click` count > 0
4. Use for remarketing campaigns

---

## Troubleshooting

### Events Not Showing in GA4

**Problem:** Events appear in Tag Assistant but not in GA4

**Solutions:**
1. Wait 24-48 hours (GA4 has processing delay)
2. Check property ID matches: **G-VW0TD1TTTK**
3. Verify GTM container is publishing: **GTM-P3MLNSCV**
4. Use DebugView for real-time verification

### Conversions Not Counting

**Problem:** Events show but conversions don't increment

**Solutions:**
1. Verify event is marked as conversion in **Admin** → **Events**
2. Check if user has ad-blocker enabled (test in incognito)
3. Ensure `gtag` is loaded before events fire
4. Check browser console for JavaScript errors

### Parameters Not Appearing

**Problem:** Events fire but custom parameters are missing

**Solutions:**
1. Check parameter names match exactly (case-sensitive)
2. Verify parameters are passed in `trackEvent()` calls
3. Check network tab for parameters in `collect` request
4. Wait for parameters to populate (can take 24 hours)

---

## Key Metrics to Monitor

Track these metrics weekly:

### Conversion Metrics
- **Conversion Rate:** % of visitors who convert
- **Cost Per Conversion:** Ad spend / conversions
- **Conversion Value:** Total value of all conversions

### Engagement Metrics
- **Avg. Engagement Time:** How long users stay
- **Event Count Per User:** Actions taken per visitor
- **Bounce Rate:** % of single-page sessions

### Agent Metrics
- **Top Converting Agents:** Which professionals get most clicks
- **Agent Type Performance:** Established vs. Hungry vs. Dentist
- **Market Performance:** Which cities perform best

---

## Next Steps

1. ✅ **Verify Events** (24-48 hours after traffic)
2. ✅ **Mark Conversions** (contact_cta_click, agent_profile_click)
3. ✅ **Set Values** (optional but recommended)
4. ✅ **Create Custom Reports** (agent performance tracking)
5. ✅ **Link Google Ads** (if running paid campaigns)
6. ✅ **Create Audiences** (for remarketing)
7. ✅ **Set Up Alerts** (for conversion drops)

---

## Resources

- [GA4 Conversions Guide](https://support.google.com/analytics/answer/9267568)
- [GA4 Event Parameters](https://support.google.com/analytics/answer/11396839)
- [GA4 DebugView](https://support.google.com/analytics/answer/7201382)
- [Google Ads Conversion Tracking](https://support.google.com/google-ads/answer/1722022)

---

## Support

For questions about GA4 setup:
- GA4 Help Center: [support.google.com/analytics](https://support.google.com/analytics)
- Google Ads Support: [support.google.com/google-ads](https://support.google.com/google-ads)

For tracking implementation questions, refer to `GA4_TRACKING_GUIDE.md`.
