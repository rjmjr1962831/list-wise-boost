import { City } from '@/types/directory';

const cityData = [
  { name: "New York", state: "New York" },
  { name: "Los Angeles", state: "California" },
  { name: "Chicago", state: "Illinois" },
  { name: "Houston", state: "Texas" },
  { name: "Phoenix", state: "Arizona" },
  { name: "Philadelphia", state: "Pennsylvania" },
  { name: "San Antonio", state: "Texas" },
  { name: "San Diego", state: "California" },
  { name: "Dallas", state: "Texas" },
  { name: "Jacksonville", state: "Florida" },
  { name: "Fort Worth", state: "Texas" },
  { name: "San Jose", state: "California" },
  { name: "Austin", state: "Texas" },
  { name: "Charlotte", state: "North Carolina" },
  { name: "Columbus", state: "Ohio" },
  { name: "Indianapolis", state: "Indiana" },
  { name: "San Francisco", state: "California" },
  { name: "Seattle", state: "Washington" },
  { name: "Denver", state: "Colorado" },
  { name: "Oklahoma City", state: "Oklahoma" },
  { name: "Nashville", state: "Tennessee" },
  { name: "El Paso", state: "Texas" },
  { name: "Washington", state: "District of Columbia" },
  { name: "Boston", state: "Massachusetts" },
  { name: "Portland", state: "Oregon" },
  { name: "Las Vegas", state: "Nevada" },
  { name: "Detroit", state: "Michigan" },
  { name: "Memphis", state: "Tennessee" },
  { name: "Louisville", state: "Kentucky" },
  { name: "Baltimore", state: "Maryland" },
  { name: "Milwaukee", state: "Wisconsin" },
  { name: "Albuquerque", state: "New Mexico" },
  { name: "Fresno", state: "California" },
  { name: "Tucson", state: "Arizona" },
  { name: "Sacramento", state: "California" },
  { name: "Mesa", state: "Arizona" },
  { name: "Kansas City", state: "Missouri" },
  { name: "Atlanta", state: "Georgia" },
  { name: "Colorado Springs", state: "Colorado" },
  { name: "Omaha", state: "Nebraska" },
  { name: "Raleigh", state: "North Carolina" },
  { name: "Long Beach", state: "California" },
  { name: "Virginia Beach", state: "Virginia" },
  { name: "Oakland", state: "California" },
  { name: "Minneapolis", state: "Minnesota" },
  { name: "Tulsa", state: "Oklahoma" },
  { name: "Arlington", state: "Texas" },
  { name: "Tampa", state: "Florida" },
  { name: "Aurora", state: "Colorado" },
  { name: "New Orleans", state: "Louisiana" },
  { name: "Wichita", state: "Kansas" },
  { name: "Cleveland", state: "Ohio" },
  { name: "Bakersfield", state: "California" },
  { name: "Anaheim", state: "California" },
  { name: "Honolulu", state: "Hawaii" },
  { name: "Santa Ana", state: "California" },
  { name: "Riverside", state: "California" },
  { name: "Stockton", state: "California" },
  { name: "Lexington", state: "Kentucky" },
  { name: "Corpus Christi", state: "Texas" },
  { name: "Henderson", state: "Nevada" },
  { name: "Anchorage", state: "Alaska" },
  { name: "Plano", state: "Texas" },
  { name: "St. Louis", state: "Missouri" },
  { name: "Lincoln", state: "Nebraska" },
  { name: "Orlando", state: "Florida" },
  { name: "Irvine", state: "California" },
  { name: "Jersey City", state: "New Jersey" },
  { name: "Chula Vista", state: "California" },
  { name: "Durham", state: "North Carolina" },
  { name: "Fort Wayne", state: "Indiana" },
  { name: "St. Paul", state: "Minnesota" },
  { name: "Laredo", state: "Texas" },
  { name: "Garland", state: "Texas" },
  { name: "North Las Vegas", state: "Nevada" },
  { name: "Buffalo", state: "New York" },
  { name: "Gilbert", state: "Arizona" },
  { name: "Reno", state: "Nevada" },
  { name: "Chesapeake", state: "Virginia" },
  { name: "Scottsdale", state: "Arizona" },
  { name: "Glendale", state: "Arizona" },
  { name: "Enterprise", state: "Nevada" },
  { name: "Winston-Salem", state: "North Carolina" },
  { name: "Toledo", state: "Ohio" },
  { name: "Pittsburgh", state: "Pennsylvania" },
  { name: "Newark", state: "New Jersey" },
  { name: "Madison", state: "Wisconsin" }
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export const cities: City[] = cityData.map(city => ({
  name: city.name,
  state: city.state,
  slug: slugify(city.name),
  stateSlug: slugify(city.state)
}));

export function getCityBySlug(citySlug: string, stateSlug?: string): City | undefined {
  return cities.find(city => {
    if (stateSlug) {
      return city.slug === citySlug && city.stateSlug === stateSlug;
    }
    return city.slug === citySlug;
  });
}

export function getCitiesByState(stateSlug: string): City[] {
  return cities.filter(city => city.stateSlug === stateSlug);
}
