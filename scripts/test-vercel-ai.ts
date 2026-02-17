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

async function testAIRouter() {
  console.log('Testing AI Router with Vercel AI Gateway...\n');

  const testMessage = 'Write a short professional bio for a real estate agent named John Smith who has 10 years of experience.';

  console.log('Calling ai-router with task: bio-generation');
  console.log('Message:', testMessage);
  console.log('\nInvoking function...\n');

  const { data, error } = await supabase.functions.invoke('ai-router', {
    body: {
      messages: [
        { role: 'user', content: testMessage }
      ],
      task: 'bio-generation',
      temperature: 0.7,
      maxTokens: 200
    }
  });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Success!\n');
  console.log('Response:', JSON.stringify(data, null, 2));
  console.log('\n📊 Details:');
  console.log(`  Provider: ${data.provider}`);
  console.log(`  Model used: ${data.routing?.model || data.model || 'N/A'}`);
  console.log(`  Tokens: ${data.usage?.total_tokens || 'N/A'}`);
  
  const content = data.choices?.[0]?.message?.content || data.content || 'No content';
  console.log(`\n💬 Generated Bio:\n${content}\n`);
}

testAIRouter();
