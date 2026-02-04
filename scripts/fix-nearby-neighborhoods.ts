/**
 * Script to audit and fix nearby neighborhoods data
 * Run with: npx tsx scripts/fix-nearby-neighborhoods.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bgdtekbhelormzbymkhh.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHRla2JoZWxvcm16Ynlta2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjMxOTEsImV4cCI6MjA3ODA5OTE5MX0.pCRa4kAOE2tKzs7JNkoPtfT24sq-50KG7Eopz1-8oCk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface AuditIssue {
  neighborhood_id: string;
  neighborhood_name: string;
  city: string;
  state: string;
  issues: {
    nearby_name: string;
    nearby_state: string;
    problem: string;
  }[];
}

async function runAudit(): Promise<AuditIssue[]> {
  console.log('='.repeat(60));
  console.log('RUNNING AUDIT');
  console.log('='.repeat(60));
  console.log();

  // Paginate to get ALL neighborhoods (not just 1,000)
  console.log('Fetching all neighborhoods...');
  const neighborhoods = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('neighborhood_catalog')
      .select('id, neighborhood, city_area, state, nearby_neighborhoods')
      .eq('is_active', true)
      .not('nearby_neighborhoods', 'is', null)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    neighborhoods.push(...data);
    console.log(`  Fetched ${neighborhoods.length} neighborhoods...`);

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const issues: AuditIssue[] = [];
  let totalChecked = 0;

  console.log(`\nChecking ${neighborhoods.length} neighborhoods...\n`);

  for (const neighborhood of neighborhoods) {
    totalChecked++;
    const nearbyList = neighborhood.nearby_neighborhoods;

    if (!Array.isArray(nearbyList) || nearbyList.length === 0) continue;

    const neighborhoodIssues: AuditIssue['issues'] = [];

    // Check each nearby neighborhood
    for (const nearby of nearbyList) {
      const nearbyName = typeof nearby === 'string' ? nearby : nearby.name || nearby.neighborhood;

      // Find this neighborhood in the catalog
      const { data: nearbyData } = await supabase
        .from('neighborhood_catalog')
        .select('neighborhood, city_area, state, lat, lon')
        .ilike('neighborhood', nearbyName)
        .limit(10);

      if (!nearbyData || nearbyData.length === 0) {
        neighborhoodIssues.push({
          nearby_name: nearbyName,
          nearby_state: 'Unknown',
          problem: 'Neighborhood not found in catalog'
        });
        continue;
      }

      // Check if any match is in the same state
      const sameState = nearbyData.find(n =>
        n.state.toLowerCase() === neighborhood.state.toLowerCase()
      );

      if (!sameState) {
        // Different state - this is a real problem
        const closest = nearbyData[0];
        neighborhoodIssues.push({
          nearby_name: nearbyName,
          nearby_state: closest.state,
          problem: `WRONG STATE: ${closest.state} (should be ${neighborhood.state})`
        });
      }
    }

    if (neighborhoodIssues.length > 0) {
      issues.push({
        neighborhood_id: neighborhood.id,
        neighborhood_name: neighborhood.neighborhood,
        city: neighborhood.city_area,
        state: neighborhood.state,
        issues: neighborhoodIssues
      });
    }

    // Progress indicator
    if (totalChecked % 50 === 0) {
      console.log(`  Checked ${totalChecked} neighborhoods...`);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('AUDIT RESULTS');
  console.log('='.repeat(60));
  console.log(`Total checked: ${totalChecked}`);
  console.log(`Issues found: ${issues.length}\n`);

  if (issues.length > 0) {
    console.log('Neighborhoods with issues:');
    for (const issue of issues) {
      console.log(`\n  ${issue.neighborhood_name} (${issue.city}, ${issue.state})`);
      for (const prob of issue.issues) {
        console.log(`    ❌ ${prob.nearby_name} - ${prob.problem}`);
      }
    }
  }

  return issues;
}

async function fixNeighborhood(neighborhoodId: string, neighborhoodName: string): Promise<boolean> {
  try {
    console.log(`  Fixing: ${neighborhoodName}...`);

    const { data, error } = await supabase.functions.invoke('enrichment-api', {
      body: {
        action: 'recompute-nearby',
        id: neighborhoodId
      }
    });

    if (error) throw error;

    console.log(`    ✓ Fixed (found ${data.nearby_count} nearby neighborhoods)`);
    return true;
  } catch (error: any) {
    console.error(`    ✗ Failed: ${error.message}`);
    return false;
  }
}

async function fixAllIssues(issues: AuditIssue[]): Promise<void> {
  console.log();
  console.log('='.repeat(60));
  console.log('FIXING ISSUES');
  console.log('='.repeat(60));
  console.log();

  let fixed = 0;
  let failed = 0;

  for (const issue of issues) {
    const success = await fixNeighborhood(issue.neighborhood_id, issue.neighborhood_name);
    if (success) {
      fixed++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log();
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total issues: ${issues.length}`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Failed: ${failed}`);
  console.log('='.repeat(60));
}

async function main() {
  try {
    // Run audit
    const issues = await runAudit();

    if (issues.length === 0) {
      console.log('\n✅ No issues found! All nearby neighborhoods are correct.\n');
      return;
    }

    // Fix issues
    await fixAllIssues(issues);

    // Re-run audit to verify
    console.log('\n\nRe-running audit to verify fixes...\n');
    const remainingIssues = await runAudit();

    if (remainingIssues.length === 0) {
      console.log('\n🎉 All issues resolved!\n');
    } else {
      console.log(`\n⚠️  ${remainingIssues.length} issues remain. May need manual review.\n`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
