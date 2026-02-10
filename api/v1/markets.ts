import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req;
    const state = query.state as string | undefined;
    const includeNeighborhoods = query.include_neighborhoods === 'true';

    // Get cities with agent counts
    let citiesQuery = supabase
      .from('professionals')
      .select('state, state_slug, city, city_slug')
      .eq('active', true);

    if (state) {
      citiesQuery = citiesQuery.ilike('state', `%${state}%`);
    }

    const { data: citiesData, error: citiesError } = await citiesQuery;
    if (citiesError) {
      console.error('Cities query error:', citiesError);
      return res.status(500).json({ error: 'Failed to retrieve markets' });
    }

    // Group by state and city
    const statesMap = new Map();
    const cityCountsMap = new Map();

    citiesData.forEach(row => {
      const stateKey = row.state;
      const cityKey = `${row.state}:${row.city}`;

      if (!statesMap.has(stateKey)) {
        statesMap.set(stateKey, {
          state: row.state,
          state_slug: row.state_slug,
          cities: new Map()
        });
      }

      const stateData = statesMap.get(stateKey);
      if (!stateData.cities.has(cityKey)) {
        stateData.cities.set(cityKey, {
          city: row.city,
          city_slug: row.city_slug,
          agent_count: 0,
          url: `https://www.top10lists.us/${row.state_slug}/${row.city_slug}/top10realestateagents`
        });
      }

      // Count increment
      cityCountsMap.set(cityKey, (cityCountsMap.get(cityKey) || 0) + 1);
    });

    // Apply counts
    statesMap.forEach(stateData => {
      stateData.cities.forEach((cityData: any, cityKey: string) => {
        cityData.agent_count = cityCountsMap.get(cityKey) || 0;
      });
    });

    // Format output
    const states = Array.from(statesMap.values()).map(state => {
      const cities = Array.from(state.cities.values());
      const agentCount = cities.reduce((sum: number, city: any) => sum + city.agent_count, 0);
      
      return {
        state: state.state,
        state_slug: state.state_slug,
        agent_count: agentCount,
        cities
      };
    });

    const totalAgents = citiesData.length;
    const totalCities = Array.from(statesMap.values())
      .reduce((sum, state) => sum + state.cities.size, 0);

    const response = {
      states,
      summary: {
        total_states: states.length,
        total_cities: totalCities,
        total_agents: totalAgents
      },
      last_updated: new Date().toISOString()
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Markets API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
