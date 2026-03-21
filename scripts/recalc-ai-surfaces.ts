/**
 * Recalculate agent_ai_surfaces and agent_ai_surfaces_by_bot
 * based on 7-day bot crawl data.
 *
 * Every crawl of a city or neighborhood page counts as a surface
 * for EVERY agent listed on that page (agents share city_id).
 * Profile page and artifact crawls count for the specific agent.
 *
 * Run: npx tsx scripts/recalc-ai-surfaces.ts
 */
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sb = createClient(SB_URL, SB_KEY);

async function sql(query: string): Promise<any[]> {
  const { data, error } = await sb.rpc('run_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}`);
  return data || [];
}

async function main() {
  console.log('Step 1: Get city crawl counts (7 days)...');
  // City crawls: /{state}/{city}/top10realestateagents
  const cityCrawls = await sql(`
    SELECT
      split_part(page_path, '/', 2) as state_slug,
      split_part(page_path, '/', 3) as city_slug,
      bot_name,
      COUNT(*) as crawls
    FROM bot_crawl_logs
    WHERE crawled_at > now() - interval '7 days'
      AND page_path ~ '^/[a-z-]+/[a-z0-9-]+/top10realestateagents'
      AND page_path !~ '^/[a-z-]+/[a-z0-9-]+/[a-z0-9-]+/top10'
    GROUP BY 1, 2, 3
  `);
  console.log(`  ${cityCrawls.length} city/bot combinations`);

  console.log('Step 2: Get neighborhood crawl counts (7 days)...');
  // Neighborhood crawls use the same city agents: /{state}/{city}/{nh}/top10
  const nhCrawls = await sql(`
    SELECT
      split_part(page_path, '/', 2) as state_slug,
      split_part(page_path, '/', 3) as city_slug,
      bot_name,
      COUNT(*) as crawls
    FROM bot_crawl_logs
    WHERE crawled_at > now() - interval '7 days'
      AND page_path ~ '^/[a-z-]+/[a-z0-9-]+/[a-z0-9-]+/top10realestateagents'
    GROUP BY 1, 2, 3
  `);
  console.log(`  ${nhCrawls.length} neighborhood/bot combinations`);

  console.log('Step 3: Get profile crawl counts (7 days)...');
  const profileCrawls = await sql(`
    SELECT
      split_part(page_path, '/', 4) as canonical_slug,
      bot_name,
      COUNT(*) as crawls
    FROM bot_crawl_logs
    WHERE crawled_at > now() - interval '7 days'
      AND page_path ~ '^/[a-z-]+/agents/[a-z0-9-]+'
    GROUP BY 1, 2
  `);
  console.log(`  ${profileCrawls.length} profile/bot combinations`);

  console.log('Step 4: Get agent-city mapping...');
  const agentCities = await sql(`
    SELECT p.id as agent_id, p.canonical_slug, c.slug as city_slug, c.state_slug
    FROM professionals p
    JOIN cities c ON c.id = p.city_id
    WHERE p.active = true
  `);
  console.log(`  ${agentCities.length} active agents with cities`);

  // Build lookup: state_slug:city_slug -> [agent_ids]
  const cityToAgents = new Map<string, string[]>();
  const slugToAgent = new Map<string, string>();
  for (const a of agentCities) {
    const key = `${a.state_slug}:${a.city_slug}`;
    if (!cityToAgents.has(key)) cityToAgents.set(key, []);
    cityToAgents.get(key)!.push(a.agent_id);
    if (a.canonical_slug) slugToAgent.set(a.canonical_slug, a.agent_id);
  }

  console.log('Step 5: Calculate per-agent surfaces...');
  // agent_id -> { bot_name -> { city, nh, profile } }
  const surfaces = new Map<string, Map<string, { city: number; nh: number; profile: number }>>();

  function add(agentId: string, botName: string, type: 'city' | 'nh' | 'profile', count: number) {
    if (!surfaces.has(agentId)) surfaces.set(agentId, new Map());
    const botMap = surfaces.get(agentId)!;
    if (!botMap.has(botName)) botMap.set(botName, { city: 0, nh: 0, profile: 0 });
    botMap.get(botName)![type] += count;
  }

  // City crawls -> all agents in that city
  for (const c of cityCrawls) {
    const key = `${c.state_slug}:${c.city_slug}`;
    const agents = cityToAgents.get(key) || [];
    for (const agentId of agents) {
      add(agentId, c.bot_name, 'city', Number(c.crawls));
    }
  }

  // Neighborhood crawls -> all agents in the parent city
  for (const n of nhCrawls) {
    const key = `${n.state_slug}:${n.city_slug}`;
    const agents = cityToAgents.get(key) || [];
    for (const agentId of agents) {
      add(agentId, n.bot_name, 'nh', Number(n.crawls));
    }
  }

  // Profile crawls -> specific agent
  for (const p of profileCrawls) {
    const agentId = slugToAgent.get(p.canonical_slug);
    if (agentId) add(agentId, p.bot_name, 'profile', Number(p.crawls));
  }

  console.log(`  ${surfaces.size} agents with surfaces`);

  // Build insert rows
  const surfaceRows: any[] = [];
  const byBotRows: any[] = [];
  const now = new Date().toISOString();

  for (const [agentId, botMap] of surfaces) {
    let totalCity = 0, totalNh = 0, totalProfile = 0;
    for (const [botName, counts] of botMap) {
      const botTotal = counts.city + counts.nh + counts.profile;
      totalCity += counts.city;
      totalNh += counts.nh;
      totalProfile += counts.profile;
      byBotRows.push({
        agent_id: agentId,
        bot_name: botName,
        crawls: botTotal,
        computed_at: now,
      });
    }
    surfaceRows.push({
      agent_id: agentId,
      period: '7d',
      city_surfaces: totalCity,
      neighborhood_surfaces: totalNh,
      profile_surfaces: totalProfile,
      total_surfaces: totalCity + totalNh + totalProfile,
      computed_at: now,
    });
  }

  // Sample output
  const topAgents = surfaceRows.sort((a, b) => b.total_surfaces - a.total_surfaces).slice(0, 5);
  console.log('\nTop 5 agents by total surfaces:');
  for (const a of topAgents) {
    console.log(`  ${a.agent_id}: ${a.total_surfaces.toLocaleString()} (city: ${a.city_surfaces.toLocaleString()}, nh: ${a.neighborhood_surfaces.toLocaleString()}, profile: ${a.profile_surfaces.toLocaleString()})`);
  }

  console.log(`\nStep 6: Clear old data and insert ${surfaceRows.length} surface rows + ${byBotRows.length} by-bot rows...`);

  // Delete old data
  await sb.from('agent_ai_surfaces').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('agent_ai_surfaces_by_bot').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert surfaces
  for (let i = 0; i < surfaceRows.length; i += 500) {
    const batch = surfaceRows.slice(i, i + 500);
    const { error } = await sb.from('agent_ai_surfaces').insert(batch);
    if (error) { console.error(`  Surface insert error at ${i}: ${error.message}`); break; }
  }
  console.log(`  Inserted ${surfaceRows.length} agent_ai_surfaces rows`);

  // Insert by-bot
  for (let i = 0; i < byBotRows.length; i += 500) {
    const batch = byBotRows.slice(i, i + 500);
    const { error } = await sb.from('agent_ai_surfaces_by_bot').insert(batch);
    if (error) { console.error(`  By-bot insert error at ${i}: ${error.message}`); break; }
  }
  console.log(`  Inserted ${byBotRows.length} agent_ai_surfaces_by_bot rows`);

  // Update professionals.ai_surfaces_monthly_est
  const monthScale = 30 / 7; // scale 7-day to 30-day estimate
  let updated = 0;
  for (let i = 0; i < surfaceRows.length; i += 100) {
    const batch = surfaceRows.slice(i, i + 100);
    for (const s of batch) {
      const { error } = await sb.from('professionals')
        .update({
          ai_surfaces_monthly_est: Math.round(s.total_surfaces * monthScale),
          ai_surfaces_updated_at: now,
        })
        .eq('id', s.agent_id);
      if (!error) updated++;
    }
    if ((i + 100) % 500 === 0 || i + 100 >= surfaceRows.length) {
      console.log(`  Updated professionals: ${updated} / ${surfaceRows.length}`);
    }
  }

  console.log(`\nDone. ${surfaces.size} agents recalculated.`);
}

main().catch(console.error);
