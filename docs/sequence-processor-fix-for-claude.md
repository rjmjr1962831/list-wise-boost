# Email sequence fix: exact code changes for Claude

**Goal:** 5-minute gap between each email (same account). Stagger accounts: account1 sends at minute 0, account2 at minute 1, then next run 5 min later. Only use robert@toptenlists.us and hello@toptenlists.us.

---

## 1. Function: `supabase/functions/sequence-processor/index.ts`

### 1.1 Add per-invocation cap constant (after line 15, before `function getDailyLimit`)

**Insert this block:**

```ts
// PER-INVOCATION CAP: Do not remove or increase without explicit approval.
// One email per account per run = 5-minute spacing; protects domain reputation.
const MAX_SENDS_PER_ACCOUNT_PER_RUN = 1;

// Stagger between accounts within one run (minute 0 = account1, minute 1 = account2).
const STAGGER_MS_BETWEEN_ACCOUNTS = 60_000;
```

### 1.2 Cap enrollment fetch to 1 per account (replace lines 159â€“167)

**Current code:**

```ts
    // Get due enrollments, limited to remaining daily budget
    const { data: enrollments } = await supabase
      .from("crm_sequence_enrollments")
      .select("*, crm_sequences(name)")
      .eq("assigned_account", account.email)
      .eq("status", "active")
      .lte("next_send_at", new Date().toISOString())
      .order("next_send_at", { ascending: true })
      .limit(remaining);
```

**Replace with:**

```ts
    // Get due enrollments: at most 1 per account per run (5-min gap between sends from same account).
    const limitThisRun = Math.min(remaining, MAX_SENDS_PER_ACCOUNT_PER_RUN);
    const { data: enrollments } = await supabase
      .from("crm_sequence_enrollments")
      .select("*, crm_sequences(name)")
      .eq("assigned_account", account.email)
      .eq("status", "active")
      .lte("next_send_at", new Date().toISOString())
      .order("next_send_at", { ascending: true })
      .limit(limitThisRun);
```

### 1.3 Remove the 5-second pause between sends (delete lines 296â€“298)

**Delete these lines:**

```ts
        // 5 second pause between sends
        await new Promise(r => setTimeout(r, 5000));
```

(We send at most 1 per account per run, so no intra-account delay is needed.)

### 1.4 Add 1-minute stagger after an account sends (after the account's inner loop, before `results.push`)

**Current code (lines 306â€“314):**

```ts
    }

    results.push({
      account: account.email,
      sent: accountSent.length,
```

**Replace with:**

```ts
    }

    // Stagger: next account sends ~1 minute after this one (minute 0 = account1, minute 1 = account2).
    if (accountSent.length > 0) {
      await new Promise((r) => setTimeout(r, STAGGER_MS_BETWEEN_ACCOUNTS));
    }

    results.push({
      account: account.email,
      sent: accountSent.length,
```

---

## 2. Function: `supabase/functions/sequence-enroll/index.ts`

### 2.1 Use only the two toptenlists.us sending accounts (replace lines 9â€“15)

**Current code:**

```ts
const SENDING_ACCOUNTS = [
  "robert@top10lists.us",
  "hello@top10lists.us",
  "robert@toptenlists.us",
  "hello@toptenlists.us",
];
```

**Replace with:**

```ts
// Must match sequence-processor: only these two accounts send.
const SENDING_ACCOUNTS = [
  "robert@toptenlists.us",
  "hello@toptenlists.us",
];
```

No other changes are required in sequence-enroll. The schedule (5-min slots, 25/day per account) stays the same; `perDay` will be `2 * EMAILS_PER_ACCOUNT_PER_DAY` and enrollments will be spread across the two accounts and 5-minute slots.

---

## Summary for Claude

| File | Change |
|------|--------|
| `supabase/functions/sequence-processor/index.ts` | 1) Add `MAX_SENDS_PER_ACCOUNT_PER_RUN = 1` and `STAGGER_MS_BETWEEN_ACCOUNTS = 60_000`. 2) Use `Math.min(remaining, MAX_SENDS_PER_ACCOUNT_PER_RUN)` as `.limit(...)`. 3) Remove the 5-second pause between sends. 4) After each account's inner loop, if `accountSent.length > 0`, `await` 60s before continuing to the next account. |
| `supabase/functions/sequence-enroll/index.ts` | Set `SENDING_ACCOUNTS` to only `["robert@toptenlists.us", "hello@toptenlists.us"]`. |

Do not modify: email-track, unsubscribe, gmail-sync, or pg_cron. Only change the two files above.
