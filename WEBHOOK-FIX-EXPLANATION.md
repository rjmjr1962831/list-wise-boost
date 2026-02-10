# Stripe Webhook Fix - What Was Wrong & How It's Fixed

**Date:** 2026-02-10

---

## The Problem

**Cursor's webhook was designed for a different system:**

### What Cursor Built:
- Looked for professionals by `stripe_subscription_id`
- Required `agent_city_subscriptions` table (doesn't exist)
- Listened for `invoice.payment_succeeded` (works)
- Updated `subscription_status` (works)
- **Never touched badge_tier or badge_status** (broken)

### Why It Failed:
```javascript
// Cursor's code tried to find professional like this:
const { data: subscription } = await supabase
  .from('agent_city_subscriptions')  // ❌ Table doesn't exist
  .select('professional_id')
  .eq('stripe_subscription_id', subscriptionId)
  .single()

// Then updated:
await supabase
  .from('professionals')
  .update({
    subscription_status: 'active',  // ✅ This worked
    last_payment_at: now            // ✅ This worked
    // ❌ Never set badge_tier
    // ❌ Never set badge_status
  })
```

**Result:** Webhook received events, updated payment timestamps, but ignored badge tiers completely.

---

## The Fix

### New Logic:

**1. Find Professional by Email (Not Subscription ID)**
```typescript
const { data: professional } = await supabase
  .from('professionals')
  .select('id, name, email')
  .ilike('email', customerEmail)  // ✅ Case-insensitive email match
  .single()
```

**2. Determine Tier from Payment Amount**
```typescript
const amountPaid = invoice.amount_paid / 100

let tier = 'certified'
if (amountPaid >= 150) {
  tier = 'underwritten'  // $150/month = yellow badge
} else if (amountPaid >= 50) {
  tier = 'accredited'    // $50/month = gold badge
}
// else certified (free = blue badge)
```

**3. Update Badge Tier AND Status**
```typescript
await supabase
  .from('professionals')
  .update({
    badge_tier: tier,              // ✅ NEW: Sets tier based on amount
    badge_status: 'active',        // ✅ NEW: Activates badge
    last_payment_at: now,
    payment_failed_at: null,       // ✅ NEW: Clears failure
    grace_period_ends_at: null,    // ✅ NEW: Clears grace period
    subscription_status: 'active',
    monthly_revenue_cents: amountPaid * 100,
    last_payment_status: 'succeeded',
  })
```

---

## Event Handling

### invoice.paid / invoice.payment_succeeded
**Trigger:** Customer pays successfully

**Actions:**
1. Extract customer email and amount
2. Find professional by email
3. Determine tier: $150+ = underwritten, $50+ = accredited, else certified
4. Update badge_tier and badge_status = 'active'
5. Clear any grace period or failure flags
6. Badge image automatically shows new tier

**Example:**
```
Customer pays $50
→ Webhook sets badge_tier = 'accredited'
→ Badge image URL returns GOLD badge
```

---

### invoice.payment_failed
**Trigger:** Payment fails

**Actions:**
1. Find professional by email
2. Set badge_status = 'grace_period'
3. Set grace_period_ends_at = now + 3 days
4. Set payment_failed_at = now
5. Badge tier UNCHANGED (still shows paid tier)
6. After 3 days, cron job downgrades to certified

**Example:**
```
Payment fails for accredited agent
→ badge_status = 'grace_period'
→ Badge still shows GOLD (tier unchanged)
→ 3 days later: cron sets badge_tier = 'certified'
→ Badge changes to BLUE
```

---

### customer.subscription.deleted
**Trigger:** Customer cancels subscription

**Current:** Logs event (manual intervention)
**Future:** Could immediate downgrade to certified

---

### customer.subscription.updated
**Trigger:** Subscription tier changes

**Current:** Logged, handled by invoice.paid events
**Reason:** Tier is determined by payment amount, not subscription metadata

---

## Payment Amount → Tier Mapping

| Monthly Payment | Tier | Badge Color | Badge File |
|----------------|------|-------------|------------|
| $0 | certified | Blue | certified.png |
| $50 | accredited | Gold | accredited.png |
| $150 | underwritten | Yellow | underwritten.png |

**How It Works:**
```typescript
if (amountPaid >= 150) tier = 'underwritten'
else if (amountPaid >= 50) tier = 'accredited'
else tier = 'certified'
```

---

## Testing the Fix

### Before Deployment:
```sql
SELECT badge_tier, badge_status FROM professionals 
WHERE email = 'allisoncahillslp@gmail.com';
-- Result: certified, active
```

### Deploy Fixed Webhook:
```bat
cd C:\Edge\list-wise-boost
git pull
DEPLOY-FIXED-WEBHOOK.bat
```

### After Deployment:
**The script automatically:**
1. Deploys new webhook
2. Sends test invoice.paid ($50)
3. Checks database for tier change
4. Downloads badge image
5. Opens badge image (should be gold)
6. Sends test payment failure
7. Checks grace period was set

---

## Logging & Debugging

### Console Logs Added:
```typescript
console.log('Processing payment:', { email, amount })
console.log('Determined tier:', tier)
console.log('Found professional:', professional.id)
console.log('✅ Updated professional to tier', tier)
```

### Check Logs in Supabase:
1. Go to https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/logs
2. Select "Edge Functions"
3. Filter by "stripe-webhook"
4. Look for the console.log messages

**Good Log:**
```
Processing payment: { email: "test@example.com", amount: 50 }
Determined tier: accredited
Found professional: abc-123-def
✅ Updated professional abc-123-def to tier accredited
```

**Bad Log:**
```
Processing payment: { email: "test@example.com", amount: 50 }
Professional not found for email: test@example.com
```

---

## Verification Checklist

After running DEPLOY-FIXED-WEBHOOK.bat:

- [ ] Webhook deployed without errors
- [ ] Test payment sent successfully
- [ ] Database shows badge_tier = 'accredited'
- [ ] Database shows badge_status = 'active'
- [ ] Badge image is GOLD (not blue)
- [ ] Test failure sent successfully
- [ ] Database shows badge_status = 'grace_period'
- [ ] grace_period_ends_at is set (~3 days from now)

---

## What Still Needs Work

### Subscription Deletion Handler
**Current:** Just logs event
**Todo:** Fetch customer email via Stripe API, downgrade immediately

**Code Needed:**
```typescript
const customer = await stripe.customers.retrieve(subscription.customer)
const email = customer.email
// Then find professional and downgrade
```

### Subscription Updated Handler
**Current:** Logged, tier determined by payment amount
**Todo:** Decide if we need to handle mid-month tier changes

---

## File Changes

### Modified:
- `supabase/functions/stripe-webhook/index.ts` - Complete rewrite for badge tiers

### Added:
- `DEPLOY-FIXED-WEBHOOK.bat` - Deployment + testing script

### Unchanged:
- `supabase/functions/badge-image/index.ts` - Still works perfectly
- Database schema - Already has all needed columns
- Grace period cron - Already scheduled

---

## Summary

**Before:** Webhook updated payment timestamps but ignored badge tiers  
**After:** Webhook sets badge tier based on payment amount

**Before:** Manual SQL needed to change tiers  
**After:** Automatic tier changes on payment

**Before:** No grace period on payment failure  
**After:** 3-day grace period, then cron downgrades

**The Fix:** 200 lines of focused code that does one thing right.

---

**Next Step:** Run `DEPLOY-FIXED-WEBHOOK.bat` and verify the checklist above.
