import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv(): void {
  const env = readFileSync('.env', 'utf-8');
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testSocialMediaLinks() {
  console.log('Fetching 5 active professionals...');
  
  // Get 5 active professionals
  const { data: professionals, error } = await supabase
    .from('professionals')
    .select('id, name, social_facebook, social_instagram, social_linkedin, social_twitter, social_tiktok')
    .eq('active', true)
    .not('name', 'is', null)
    .limit(5);

  if (error || !professionals) {
    console.error('Error fetching professionals:', error);
    process.exit(1);
  }

  console.log(`Found ${professionals.length} professionals:`);
  professionals.forEach(p => {
    console.log(`  - ${p.name} (${p.id})`);
  });

  const professionalIds = professionals.map(p => p.id);

  console.log('\nCalling fetch-social-media-links function...');

  // Call the edge function
  const { data, error: fnError } = await supabase.functions.invoke('fetch-social-media-links', {
    body: {
      professionalIds,
      batchSize: 5,
      limitToSites: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter', 'TikTok']
    }
  });

  if (fnError) {
    console.error('Error calling function:', fnError);
    process.exit(1);
  }

  console.log('\nFunction response:');
  console.log(JSON.stringify(data, null, 2));

  if (data.success) {
    console.log(`\n✓ Success! Updated ${data.professionalsUpdated} professionals`);
    
    // Fetch updated records
    console.log('\nFetching updated records...');
    const { data: updated, error: updateError } = await supabase
      .from('professionals')
      .select('id, name, social_facebook, social_instagram, social_linkedin, social_twitter, social_tiktok')
      .in('id', professionalIds);

    if (!updateError && updated) {
      console.log('\nUpdated social links:');
      updated.forEach(p => {
        console.log(`\n${p.name}:`);
        if (p.social_facebook) console.log(`  Facebook: ${p.social_facebook}`);
        if (p.social_instagram) console.log(`  Instagram: ${p.social_instagram}`);
        if (p.social_linkedin) console.log(`  LinkedIn: ${p.social_linkedin}`);
        if (p.social_twitter) console.log(`  Twitter: ${p.social_twitter}`);
        if (p.social_tiktok) console.log(`  TikTok: ${p.social_tiktok}`);
        if (!p.social_facebook && !p.social_instagram && !p.social_linkedin && !p.social_twitter && !p.social_tiktok) {
          console.log('  (No social media links found)');
        }
      });
    }
  }
}

testSocialMediaLinks();
