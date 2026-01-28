/**
 * Build-time script to generate static sitemaps and coverage.json
 * Run this before build to create static assets in public/
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bgdtekbhelormzbymkhh.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHRla2JoZWxvcm16Ynlta2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjMxOTEsImV4cCI6MjA3ODA5OTE5MX0.pCRa4kAOE2tKzs7JNkoPtfT24sq-50KG7Eopz1-8oCk';
const BASE_URL = 'https://www.top10lists.us';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface City {
  slug: string;
  state_slug: string;
  name: string;
  state: string;
}

interface Neighborhood {
  neighborhood_slug: string;
  city_area_slug: string;
  primary_zip: string | null;
  state: string;
  neighborhood: string;
  city_area: string;
}

// Fetch all records with pagination
async function fetchAllCities(): Promise<City[]> {
  const allCities: City[] = [];
  const pageSize = 1000;
  let offset = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('cities')
      .select('slug, state_slug, name, state')
      .in('state_slug', ['arizona', 'california'])
      .eq('active', true)
      .order('state_slug')
      .order('slug')
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('Error fetching cities:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allCities.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  
  return allCities;
}

async function fetchAllNeighborhoods(): Promise<Neighborhood[]> {
  const allNeighborhoods: Neighborhood[] = [];
  const pageSize = 1000;
  let offset = 0;
  
  // Map full state names to slugs
  const stateMap: Record<string, string> = {
    'Arizona': 'arizona',
    'California': 'california'
  };
  
  while (true) {
    const { data, error } = await supabase
      .from('neighborhood_catalog')
      .select('neighborhood_slug, city_area_slug, primary_zip, state, neighborhood, city_area')
      .in('state', ['Arizona', 'California'])
      .eq('is_active', true)
      .not('primary_zip', 'is', null)
      .order('state')
      .order('city_area_slug')
      .order('neighborhood_slug')
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('Error fetching neighborhoods:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allNeighborhoods.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  
  return allNeighborhoods;
}

function generateCitySitemap(cities: City[]): string {
  const today = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const city of cities) {
    const url = `${BASE_URL}/${city.state_slug}/${city.slug}/top10realestateagents`;
    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  return xml;
}

function generateNeighborhoodSitemap(neighborhoods: Neighborhood[]): string {
  const today = new Date().toISOString().split('T')[0];
  
  // Map full state names to slugs
  const stateMap: Record<string, string> = {
    'Arizona': 'arizona',
    'California': 'california'
  };
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const n of neighborhoods) {
    if (!n.primary_zip) continue;
    
    const stateSlug = stateMap[n.state] || n.state.toLowerCase();
    const url = `${BASE_URL}/${stateSlug}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`;
    
    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  return xml;
}

function generateCoverageJson(cities: City[], neighborhoods: Neighborhood[]): string {
  // Map full state names to slugs
  const stateMap: Record<string, string> = {
    'Arizona': 'arizona',
    'California': 'california'
  };
  
  // Group cities by state
  const citiesByState: Record<string, { name: string; slug: string; url: string }[]> = {};
  for (const city of cities) {
    if (!citiesByState[city.state_slug]) {
      citiesByState[city.state_slug] = [];
    }
    citiesByState[city.state_slug].push({
      name: city.name,
      slug: city.slug,
      url: `${BASE_URL}/${city.state_slug}/${city.slug}/top10realestateagents`
    });
  }
  
  // Group neighborhoods by state and city
  const neighborhoodsByState: Record<string, Record<string, { name: string; slug: string; zip: string; url: string }[]>> = {};
  for (const n of neighborhoods) {
    if (!n.primary_zip) continue;
    
    const stateSlug = stateMap[n.state] || n.state.toLowerCase();
    
    if (!neighborhoodsByState[stateSlug]) {
      neighborhoodsByState[stateSlug] = {};
    }
    if (!neighborhoodsByState[stateSlug][n.city_area_slug]) {
      neighborhoodsByState[stateSlug][n.city_area_slug] = [];
    }
    
    neighborhoodsByState[stateSlug][n.city_area_slug].push({
      name: n.neighborhood,
      slug: n.neighborhood_slug,
      zip: n.primary_zip,
      url: `${BASE_URL}/${stateSlug}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`
    });
  }
  
  const coverage = {
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    stats: {
      total_cities: cities.length,
      total_neighborhoods: neighborhoods.filter(n => n.primary_zip).length,
      states: Object.keys(citiesByState).length
    },
    states: {
      arizona: {
        name: 'Arizona',
        cities_count: citiesByState['arizona']?.length || 0,
        neighborhoods_count: Object.values(neighborhoodsByState['arizona'] || {}).flat().length,
        cities: citiesByState['arizona'] || [],
        neighborhoods: neighborhoodsByState['arizona'] || {}
      },
      california: {
        name: 'California', 
        cities_count: citiesByState['california']?.length || 0,
        neighborhoods_count: Object.values(neighborhoodsByState['california'] || {}).flat().length,
        cities: citiesByState['california'] || [],
        neighborhoods: neighborhoodsByState['california'] || {}
      }
    }
  };
  
  return JSON.stringify(coverage, null, 2);
}

async function main() {
  console.log('Fetching data from Supabase...');
  
  const [cities, neighborhoods] = await Promise.all([
    fetchAllCities(),
    fetchAllNeighborhoods()
  ]);
  
  console.log(`Fetched ${cities.length} cities and ${neighborhoods.length} neighborhoods`);
  
  // Generate files
  const citySitemap = generateCitySitemap(cities);
  const neighborhoodSitemap = generateNeighborhoodSitemap(neighborhoods);
  const coverageJson = generateCoverageJson(cities, neighborhoods);
  
  // Write to public directory
  const publicDir = path.join(process.cwd(), 'public');
  
  fs.writeFileSync(path.join(publicDir, 'sitemap-cities.xml'), citySitemap);
  console.log('✓ Generated sitemap-cities.xml');
  
  fs.writeFileSync(path.join(publicDir, 'sitemap-neighborhoods.xml'), neighborhoodSitemap);
  console.log('✓ Generated sitemap-neighborhoods.xml');
  
  fs.writeFileSync(path.join(publicDir, 'coverage.json'), coverageJson);
  console.log('✓ Generated coverage.json');
  
  console.log('\nStatic sitemap generation complete!');
  console.log(`  Cities: ${cities.length}`);
  console.log(`  Neighborhoods: ${neighborhoods.filter(n => n.primary_zip).length}`);
}

main().catch(console.error);
