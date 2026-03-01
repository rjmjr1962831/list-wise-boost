/**
 * Set Beauvais (Dina and Mark Beauvais) to underwritten tier and rewrite profile
 * with underwritten data fields (synthesized_bio, press_mentions, community_roles, etc.)
 * Run: npx tsx scripts/beauvais-underwritten.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const env = readFileSync(envPath, 'utf-8');
  for (const line of env.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔍 Finding Beauvais (Dina and Mark Beauvais)...');

  const { data: beauvais, error: findError } = await supabase
    .from('professionals')
    .select('id, name, business_city, state_slug, company')
    .eq('zillow_profile_url', 'https://www.zillow.com/profile/Beauvais-Real-Estate')
    .maybeSingle();

  if (findError) {
    console.error('❌ Error finding Beauvais:', findError);
    process.exit(1);
  }
  if (!beauvais) {
    console.error('❌ Beauvais Real Estate not found');
    process.exit(1);
  }

  const cityName = beauvais.business_city || 'Scottsdale';
  const stateName = (beauvais.state_slug || 'arizona')
    .replace(/\b\w/g, (s) => s.toUpperCase());

  console.log(`   Found: ${beauvais.name} (id: ${beauvais.id})`);
  console.log(`   City: ${cityName}, State: ${stateName}\n`);

  // 1. Update current_tier to underwritten
  console.log('📝 Updating current_tier to underwritten...');
  const { error: updateError } = await supabase
    .from('professionals')
    .update({ current_tier: 'underwritten' })
    .eq('id', beauvais.id);

  if (updateError) {
    console.error('❌ Failed to update tier:', updateError);
    process.exit(1);
  }
  console.log('   ✅ Tier updated to underwritten\n');

  // 2. Rewrite profile with search-agent-exa (Exa research + synthesis)
  console.log('🔄 Running search-agent-exa (Exa research + profile synthesis)...');
  const { data: exaData, error: exaError } = await supabase.functions.invoke('search-agent-exa', {
    body: {
      agentName: beauvais.name,
      company: beauvais.company || 'Beauvais Real Estate',
      city: cityName,
      state: stateName,
      professionalId: beauvais.id,
      skipIfNoPress: false,
    },
  });

  if (exaError) {
    console.error('❌ search-agent-exa error:', exaError);
    process.exit(1);
  }

  if ((exaData as any)?.error) {
    console.error('❌ search-agent-exa returned error:', (exaData as any).error);
    process.exit(1);
  }

  const result = exaData as any;
  console.log(`   Search results: ${result.searchResultCount ?? 0}`);
  console.log(`   Synthesis triggered: ${result.synthesis?.triggered ?? false}`);
  console.log(`   Synthesis success: ${result.synthesis?.success ?? false}`);
  if (result.synthesis?.error) console.log(`   Synthesis error: ${result.synthesis.error}`);

  console.log('\n✅ Done. Beauvais is now underwritten with rewritten profile.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
