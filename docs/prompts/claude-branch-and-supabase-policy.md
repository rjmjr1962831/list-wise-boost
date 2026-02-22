# Claude: Branch and Deployment Policy (MANDATORY)

**Purpose:** This document establishes the absolute, non-negotiable rules for Git branching and production deployments. Violation can cause staging/production mix-ups and unintended changes to the live site.

---

## 1. PUSHING TO STAGING DOES NOT PUSH TO MAIN

**`staging` and `main` are separate branches.** Pushing to `staging` only updates `staging`. It does not touch `main`. Main is updated only when Robert explicitly authorizes a merge and push.

- **`git push origin staging`** — Updates the staging branch. Safe. Do this by default when saving work. Main is unaffected.
- **`main`** — Production. Vercel deploys from `main` to `https://www.top10lists.us`. Main is updated only when Robert says "push to main" and you run `npm run merge-to-main`.

**Workflow:** You push to staging. Robert tests on staging. When ready, Robert says "push to main" and you run the merge script. Until then, main stays as-is.

---

## 2. THE MAIN BRANCH RULE (HARD STOP)

### You Must NEVER:
- Push to `main`
- Merge anything into `main`
- Run `git push origin main`
- Interpret "deploy," "ship it," "go live," or "push to production" as permission to touch `main`

### The ONLY Exception
You may touch `main` if and only if Robert gives you this **exact** phrase:

> **"push to main"**

No variation. Not "push to production," not "deploy to main." Only **"push to main"** authorizes any action on the `main` branch.

### When Authorized
If Robert says "push to main":
1. Run `npm run merge-to-main`
2. Switch back to `staging` for subsequent work

---

## 3. DEFAULT BEHAVIOR: STAGING ONLY

- When Robert says "push," "commit and push," or "push your changes" — push to **`staging`** only
- When you complete a task — push to **`staging`** only
- Assume staging. Never assume main.
- Do not ask for permission to push to staging — it is expected and required

---

## 4. SUPABASE EDGE FUNCTIONS

**Never run `supabase functions deploy` without Robert's explicit instruction.**

Edge function deploys go live to production. Treat `supabase functions deploy` identically to "push to main" — it requires the same level of explicit approval. Do not deploy Edge Functions when Robert says "push" or "deploy" unless he specifically authorizes an Edge Function deploy.

---

## 5. ONE-WAY DEPLOYMENT DIRECTION

- **Allowed:** `staging` → `main` (when Robert says "push to main")
- **FORBIDDEN:** `main` → `staging` (never merge main back into staging)

---

## 6. SUMMARY

| Action | Allowed? |
|--------|----------|
| `git push origin staging` | Yes, always, without asking |
| Push to `main` | Only when Robert says "push to main" |
| `supabase functions deploy` | Only with Robert's explicit instruction |
| Default branch for work | `staging` |

---

## 7. REINFORCEMENT

**Pushing to staging does not push to main. They are separate.**

**If Robert uses any phrase other than "push to main," push to `staging` only.**

**Treat `main` as locked. Treat `staging` as the workspace.**
