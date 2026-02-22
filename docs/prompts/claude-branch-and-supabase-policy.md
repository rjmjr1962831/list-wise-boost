# Claude: Branch and Supabase Policy (MANDATORY)

**Purpose:** This document establishes the absolute, non-negotiable rules for Git branching, Supabase environments, and production deployments. Violation of these rules can cause data loss, staging/production mix-ups, and irreversible damage to the live site.

---

## 1. TWO ENVIRONMENTS, TWO BRANCHES

### Git Branches
- **`staging`** — Development and testing. All AI work, all commits, all pushes go here by default. Staging deploys to a staging host (e.g. `staging.top10lists.us`).
- **`main`** — Production. Serves the live site at `https://www.top10lists.us`. Vercel deploys from `main` to production. **You must never touch `main` unless explicitly authorized.**

### Supabase Environments
- **Staging Supabase** — Used by the staging deployment. Database, Edge Functions, and storage for testing. Schema and data may differ from production. Used for development, migrations, and validation before production.
- **Production Supabase** — Used by the live site. Project ref: `wiotrvoirdgzfacuuiem`. This is the source of truth for real users, real agents, and real data. **Never run destructive or experimental operations against production without explicit instruction.**

**Rule:** Staging and production are separate. Migrations, Edge Function deployments, and data changes on staging do not automatically apply to production. Treat them as isolated environments.

---

## 2. THE MAIN BRANCH RULE (HARD STOP)

### You Must NEVER:
- Push to `main`
- Merge anything into `main`
- Run `git push origin main`
- Suggest or execute any command that writes to `main`
- Interpret "deploy," "ship it," "go live," "release," or "push to production" as permission to touch `main`

### The ONLY Exception
You may touch `main` if and only if Robert gives you this **exact** phrase:

> **"push to main"**

No variation. Not "push to production," not "deploy to main," not "merge and push." Only **"push to main"** authorizes any action on the `main` branch.

### When Authorized
If Robert says "push to main":
1. Run `npm run merge-to-main` (do not manually merge and push — this script handles merging from staging, excluding internal documents, and pushing to main)
2. Do not bypass the script
3. Confirm the push succeeded
4. Switch back to `staging` for subsequent work

---

## 3. DEFAULT BEHAVIOR: STAGING ONLY

### What "Push" Means (Default)
- When Robert says "push," "commit and push," or "push your changes" — push to **`staging`** only
- When you complete a task and need to save work — push to **`staging`** only
- When Robert says "deploy" or "ship" without "push to main" — push to **`staging`** only
- Assume staging. Never assume main.

### Staging Push Workflow
After making code changes:
1. Stage modified files (exclude `.env`, `.secrets/`, and other secrets)
2. Commit with a clear message
3. Run: `git push origin staging`
4. Do not ask for permission to push to staging — it is expected and required
5. Batch pushes: accumulate up to ~10 changes before pushing when doing many edits

---

## 4. ONE-WAY DEPLOYMENT DIRECTION

- **Allowed:** `staging` → `main` (merge staging into main when releasing)
- **FORBIDDEN:** `main` → `staging` (never merge main back into staging, never bring production code back into staging)

Staging is the source of new work. Main receives it only when Robert explicitly authorizes a release. Reversing this flow can overwrite staging with production state and hide in-progress work.

---

## 5. SUPABASE: STAGING VS PRODUCTION

- **Migrations:** Run migrations on staging first. Validate. Only run on production when Robert approves.
- **Edge Functions:** Deploy to staging Supabase for testing. Production deployment requires explicit approval.
- **Data changes:** Test on staging. Never run bulk updates, deletes, or schema changes on production without explicit instruction.
- **Secrets:** Staging and production may use different API keys and secrets. Do not assume they are interchangeable.

---

## 6. SUMMARY (QUICK REFERENCE)

| Action | Allowed? |
|--------|----------|
| Push to `staging` | Yes, always, without asking |
| Push to `main` | Only when Robert says "push to main" |
| Merge staging → main | Only when Robert says "push to main" (via `npm run merge-to-main`) |
| Merge main → staging | Never |
| Default branch for work | `staging` |
| Supabase production changes | Only with explicit instruction |

---

## 7. REINFORCEMENT

**If you are unsure whether to push to `main`, do not push to `main`.**

**If Robert uses any phrase other than "push to main," push to `staging` only.**

**Treat `main` as locked. Treat `staging` as the workspace.**
