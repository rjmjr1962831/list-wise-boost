/**
 * POST-DEPLOY SMOKE TEST
 * Tests every registered URL pattern against production (or --base).
 * Run after EVERY deploy. If any test fails, do not proceed.
 *
 * Usage:
 *   npx tsx scripts/smoke-test.ts
 *   npx tsx scripts/smoke-test.ts --base=https://staging.top10lists.us
 */
const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ||
  "https://www.top10lists.us";

interface SmokeTest {
  name: string;
  url: string;
  expectedStatus: number;
  bodyContains?: string;
  bodyNotContains?: string[];
}

const tests: SmokeTest[] = [
  {
    name: "Health endpoint",
    url: `${BASE}/api/health`,
    expectedStatus: 200,
    bodyContains: '"ok":true',
    // Env keys must be present (health returns 200; smoke test asserts no missing keys)
    bodyNotContains: ['"hasSupabaseServiceRoleKey":false', '"hasSupabaseUrl":false'],
  },
  {
    name: "Homepage",
    url: BASE,
    expectedStatus: 200,
    bodyContains: "Top10Lists",
  },
  {
    name: "For-AI page",
    url: `${BASE}/for-ai`,
    expectedStatus: 200,
  },
  {
    name: "LLMs.txt",
    url: `${BASE}/llms.txt`,
    expectedStatus: 200,
  },
  {
    name: "State page (Arizona)",
    url: `${BASE}/arizona`,
    expectedStatus: 200,
  },
  {
    name: "City page (Phoenix)",
    url: `${BASE}/arizona/phoenix`,
    expectedStatus: 200,
  },
  {
    name: "City rankings (Phoenix)",
    url: `${BASE}/arizona/phoenix/top10realestateagents`,
    expectedStatus: 200,
  },
  {
    name: "Agent profile page",
    url: `${BASE}/arizona/agents/a-tom-wood-team-1221`,
    expectedStatus: 200,
    bodyContains: "Top10Lists",
  },
  {
    name: "Artifact (UUID)",
    url: `${BASE}/artifact/1afa3413-96eb-4d06-a896-8537c910e3f3`,
    expectedStatus: 200,
    bodyContains: "ld+json",
  },
  {
    name: "Artifact (slug-based)",
    url: `${BASE}/artifact/a-tom-wood-team-1221`,
    expectedStatus: 200,
  },
  {
    name: "Badge API",
    url: `${BASE}/api/badge/a-tom-wood-team-1221`,
    expectedStatus: 200,
    bodyContains: '"agent"',
    bodyNotContains: ['"config_error"'],
  },
  {
    name: "Badge V1 API",
    url: `${BASE}/api/v1/badge/a-tom-wood-team-1221`,
    expectedStatus: 200,
  },
  {
    name: "Dashboard magic link",
    url: `${BASE}/dashboard/e1e71db2-6469-46ec-b777-e009e02133b6`,
    expectedStatus: 200,
  },
];

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  console.log(`\n🔍 Running smoke tests against: ${BASE}\n`);
  console.log("─".repeat(60));

  for (const test of tests) {
    try {
      const resp = await fetch(test.url, { redirect: "follow" });
      const body = await resp.text();
      const errors: string[] = [];

      if (resp.status !== test.expectedStatus) {
        errors.push(
          `Expected status ${test.expectedStatus}, got ${resp.status}`
        );
      }
      if (test.bodyContains && !body.includes(test.bodyContains)) {
        errors.push(`Body missing expected: "${test.bodyContains}"`);
      }
      if (test.bodyNotContains) {
        for (const bad of test.bodyNotContains) {
          if (body.includes(bad)) {
            errors.push(`Body contains forbidden: "${bad}"`);
          }
        }
      }

      if (errors.length === 0) {
        console.log(`  ✅ ${test.name}`);
        passed++;
      } else {
        console.log(`  ❌ ${test.name}`);
        for (const e of errors) {
          console.log(`     → ${e}`);
        }
        failures.push(`${test.name}: ${errors.join("; ")}`);
        failed++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${test.name}`);
      console.log(`     → Network error: ${msg}`);
      failures.push(`${test.name}: Network error: ${msg}`);
      failed++;
    }
  }

  console.log("─".repeat(60));
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log("  ⚠️  FAILURES:");
    for (const f of failures) {
      console.log(`     • ${f}`);
    }
    console.log(
      "\n  ❗ DO NOT proceed with further work until all tests pass.\n"
    );
    process.exit(1);
  } else {
    console.log("  🎉 All smoke tests passed.\n");
  }
}

runTests();
