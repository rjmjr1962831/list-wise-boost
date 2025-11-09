# GA4 Event Tracking Implementation Guide

This document describes all GA4 events implemented across the Top10Lists.us application.

## Overview

All tracking events are sent via Google Tag Manager (GTM-P3MLNSCV) using the `gtag` function. Events are tracked through the `useGA4Tracking` hook which provides a consistent interface across components.

## Implemented Events

### 1. Agent Card Expansion (`agent_card_expand`)
**Triggered when:** User expands a collapsible section (Established/Hungry)

**Parameters:**
- `agent_name` - Name of the section (e.g., "Established Agents")
- `market` - Geographic market (e.g., "Gilbert, AZ")
- `agent_type` - Type of agent section

**Implementation:**
- `CollapsibleListSection.tsx` - Section toggle
- `GilbertRealtorList.tsx` - Section expand handlers

**Example:**
```javascript
trackEvent('agent_card_expand', {
  agent_name: 'Established Agents',
  market: 'Gilbert, AZ',
  agent_type: 'Established'
});
```

---

### 2. Agent Profile Click (`agent_profile_click`)
**Triggered when:** User clicks on an agent's website link

**Parameters:**
- `agent_name` - Name of the agent
- `market` - Geographic market
- `destination_url` - Full URL being visited
- `agent_type` - Type of agent (Established/Hungry/Dentist)

**Implementation:**
- `ProfessionalCard.tsx` - Website link clicks
- `GilbertRealtorList.tsx` - Website link clicks
- `SampleDentistList.tsx` - Website link clicks

**Example:**
```javascript
trackEvent('agent_profile_click', {
  agent_name: 'Ashley Pickens',
  market: 'Gilbert, AZ',
  destination_url: 'https://ashleypickensrealty.com',
  agent_type: 'Established'
});
```

---

### 3. Contact CTA Click (`contact_cta_click`)
**Triggered when:** User clicks phone number or website link (contact actions)

**Parameters:**
- `agent_name` - Name of the agent
- `market` - Geographic market
- `agent_type` - Type of agent

**Implementation:**
- `ProfessionalCard.tsx` - Phone and website clicks
- `GilbertRealtorList.tsx` - Phone and website clicks
- `SampleDentistList.tsx` - Phone and website clicks

**Example:**
```javascript
trackEvent('contact_cta_click', {
  agent_name: 'Ashley Pickens',
  market: 'Gilbert, AZ',
  agent_type: 'Established'
});
```

---

### 4. Badge Hover (`badge_hover`)
**Triggered when:** User hovers over a verification badge

**Parameters:**
- `badge_type` - Type of badge (e.g., "Verified", "Verified Brand Builder")
- `agent_name` - Name of the agent
- `market` - Geographic market

**Implementation:**
- `ProfessionalCard.tsx` - Badge hover events
- `GilbertRealtorList.tsx` - Badge hover events
- `SampleDentistList.tsx` - Badge hover events

**Example:**
```javascript
trackEvent('badge_hover', {
  badge_type: 'Verified Brand Builder',
  agent_name: 'Ashley Pickens',
  market: 'Gilbert, AZ'
});
```

---

### 5. Scroll Depth (`scroll_depth`)
**Triggered when:** User scrolls past 75% of the page

**Parameters:**
- `percent_scrolled` - Percentage scrolled (always 75)
- `page_path` - Current page URL path

**Implementation:**
- `GilbertRealtorList.tsx` - Scroll tracking
- `SampleDentistList.tsx` - Scroll tracking

**Note:** Only fires once per page visit using `window._scrollTracked` flag

**Example:**
```javascript
trackEvent('scroll_depth', {
  percent_scrolled: 75,
  page_path: '/gilbert-az/top-realtors'
});
```

---

## CSS Classes for Data Layer Integration

The following CSS classes are added to elements for potential GTM trigger configuration:

- `.agent-card` - Applied to collapsible sections
- `.agent-badge` - Applied to verification badges
- `.agent-profile-link` - Applied to website links
- `.contact-agent-button` - Applied to phone links

These can be used in GTM to create custom triggers without code changes.

---

## Data Attributes

Some elements include data attributes for reference:

```html
<div class="agent-card" 
     data-agent-name="Established Agents" 
     data-market="Gilbert, AZ" 
     data-agent-type="Established">
```

---

## Testing with Tag Assistant

1. Install Tag Assistant Chrome extension
2. Go to [tagassistant.google.com](https://tagassistant.google.com)
3. Click "Add domain" and enter your site URL
4. Click "Connect" to start debugging
5. Navigate through your site and verify events fire

---

## GTM Configuration

**Container ID:** GTM-P3MLNSCV

**Google Ads Measurement ID:** AW-16786179175

All events are automatically sent to Google Ads for conversion tracking.

---

## Event Summary Table

| Event Name | Purpose | Components |
|------------|---------|------------|
| `agent_card_expand` | Track section expansions | CollapsibleListSection, List Pages |
| `agent_profile_click` | Track website visits | All card components |
| `contact_cta_click` | Track contact actions | All card components |
| `badge_hover` | Track badge engagement | All card components |
| `scroll_depth` | Track page engagement | List pages |

---

## Future Events (Not Yet Implemented)

The following events from the specification are not yet implemented:

- `list_filter_applied` - Filter interactions (no filters exist yet)
- `press_mention_click` - Press citation clicks (not implemented)
- `citation_block_view` - LLM citation block views (not implemented)

---

## Troubleshooting

**Events not firing?**
1. Check browser console for `gtag not found` warnings
2. Verify GTM snippet is in the page `<head>`
3. Use Tag Assistant to debug in real-time
4. Check network tab for `collect` requests to Google

**Ad blockers:**
- Ad blockers may prevent GTM from loading
- Test with ad blockers disabled

---

## Developer Notes

- All tracking uses the `useGA4Tracking` hook from `src/hooks/useGA4Tracking.ts`
- Events follow the naming convention from the custom knowledge base
- Parameters are consistently structured across all events
- Scroll tracking only fires once per session per page
