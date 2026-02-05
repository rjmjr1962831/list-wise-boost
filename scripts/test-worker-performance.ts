// Test Cloudflare Worker performance and caching

const TEST_URL = "https://www.top10lists.us/arizona/scottsdale/85250/old-town-scottsdale/top10realestateagents";

interface TestResult {
  attempt: number;
  status: number;
  xCache: string | null;
  xRendered: string | null;
  contentLength: number;
  timeMs: number;
  success: boolean;
}

async function testWorkerRequest(attempt: number, forceRefresh: boolean = false): Promise<TestResult> {
  const startTime = Date.now();
  
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) GPTBot/1.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  if (forceRefresh) {
    headers["X-Force-Refresh"] = "true";
  }

  try {
    const response = await fetch(TEST_URL, { headers });
    const html = await response.text();
    const timeMs = Date.now() - startTime;

    return {
      attempt,
      status: response.status,
      xCache: response.headers.get("X-Cache"),
      xRendered: response.headers.get("X-Rendered"),
      contentLength: html.length,
      timeMs,
      success: response.ok && html.length > 10000
    };
  } catch (error) {
    const timeMs = Date.now() - startTime;
    return {
      attempt,
      status: 0,
      xCache: null,
      xRendered: null,
      contentLength: 0,
      timeMs,
      success: false
    };
  }
}

async function runPerformanceTest() {
  console.log("🧪 Testing Cloudflare Worker Performance\n");
  console.log("URL:", TEST_URL);
  console.log("Simulating bot user-agent: GPTBot\n");

  // Test 1: Cold cache (force refresh)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Test 1: COLD CACHE (Force Refresh)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const coldResult = await testWorkerRequest(1, true);
  console.log(`Status: ${coldResult.status}`);
  console.log(`X-Cache: ${coldResult.xCache || "NOT SET"}`);
  console.log(`X-Rendered: ${coldResult.xRendered || "NOT SET"}`);
  console.log(`Content Length: ${coldResult.contentLength.toLocaleString()} bytes`);
  console.log(`Time: ${coldResult.timeMs.toLocaleString()}ms`);
  console.log(`Success: ${coldResult.success ? "✅" : "❌"}\n`);

  if (!coldResult.success) {
    console.error("❌ Cold cache test failed! Check worker deployment.");
    return;
  }

  // Wait a moment before testing warm cache
  console.log("Waiting 2 seconds before testing warm cache...\n");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Warm cache (should be instant)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Test 2: WARM CACHE (Second Request)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const warmResult = await testWorkerRequest(2, false);
  console.log(`Status: ${warmResult.status}`);
  console.log(`X-Cache: ${warmResult.xCache || "NOT SET"}`);
  console.log(`X-Rendered: ${warmResult.xRendered || "NOT SET"}`);
  console.log(`Content Length: ${warmResult.contentLength.toLocaleString()} bytes`);
  console.log(`Time: ${warmResult.timeMs.toLocaleString()}ms`);
  console.log(`Success: ${warmResult.success ? "✅" : "❌"}\n`);

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  if (coldResult.xCache === "MISS") {
    console.log("✅ Cold cache render time:", coldResult.timeMs.toLocaleString() + "ms");
    if (coldResult.timeMs < 10000) {
      console.log("   🎉 EXCELLENT! < 10 seconds (target: 5-8s)");
    } else if (coldResult.timeMs < 15000) {
      console.log("   ✅ GOOD! < 15 seconds");
    } else {
      console.log("   ⚠️  Still slow, but better than 23s");
    }
  } else {
    console.log("⚠️  Expected X-Cache: MISS on cold cache, got:", coldResult.xCache);
  }

  if (warmResult.xCache === "HIT") {
    console.log("✅ Warm cache serve time:", warmResult.timeMs.toLocaleString() + "ms");
    if (warmResult.timeMs < 500) {
      console.log("   🎉 INSTANT! < 500ms");
    } else if (warmResult.timeMs < 2000) {
      console.log("   ✅ FAST! < 2 seconds");
    } else {
      console.log("   ⚠️  Slower than expected for cached content");
    }
  } else {
    console.log("⚠️  Expected X-Cache: HIT on warm cache, got:", warmResult.xCache);
  }

  const improvement = coldResult.timeMs < 23000 ? ((23000 - coldResult.timeMs) / 23000 * 100).toFixed(1) : 0;
  console.log(`\n🚀 Performance improvement: ${improvement}% faster than 23s baseline`);
}

// Run the test
runPerformanceTest().catch(console.error);
