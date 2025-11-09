import { City } from '@/types/directory';

const cityData = [
  { name: "New York", state: "New York", stateAbbr: "NY" },
  { name: "Los Angeles", state: "California", stateAbbr: "CA" },
  { name: "Chicago", state: "Illinois", stateAbbr: "IL" },
  { name: "Houston", state: "Texas", stateAbbr: "TX" },
  { name: "Phoenix", state: "Arizona", stateAbbr: "AZ" },
  { name: "Philadelphia", state: "Pennsylvania", stateAbbr: "PA" },
  { name: "San Antonio", state: "Texas", stateAbbr: "TX" },
  { name: "San Diego", state: "California", stateAbbr: "CA" },
  { name: "Dallas", state: "Texas", stateAbbr: "TX" },
  { name: "Jacksonville", state: "Florida", stateAbbr: "FL" },
  { name: "Fort Worth", state: "Texas", stateAbbr: "TX" },
  { name: "San Jose", state: "California", stateAbbr: "CA" },
  { name: "Austin", state: "Texas", stateAbbr: "TX" },
  { name: "Charlotte", state: "North Carolina", stateAbbr: "NC" },
  { name: "Columbus", state: "Ohio", stateAbbr: "OH" },
  { name: "Indianapolis", state: "Indiana", stateAbbr: "IN" },
  { name: "San Francisco", state: "California", stateAbbr: "CA" },
  { name: "Seattle", state: "Washington", stateAbbr: "WA" },
  { name: "Denver", state: "Colorado", stateAbbr: "CO" },
  { name: "Oklahoma City", state: "Oklahoma", stateAbbr: "OK" },
  { name: "Nashville", state: "Tennessee", stateAbbr: "TN" },
  { name: "El Paso", state: "Texas", stateAbbr: "TX" },
  { name: "Washington", state: "District of Columbia", stateAbbr: "DC" },
  { name: "Boston", state: "Massachusetts", stateAbbr: "MA" },
  { name: "Portland", state: "Oregon", stateAbbr: "OR" },
  { name: "Las Vegas", state: "Nevada", stateAbbr: "NV" },
  { name: "Detroit", state: "Michigan", stateAbbr: "MI" },
  { name: "Memphis", state: "Tennessee", stateAbbr: "TN" },
  { name: "Louisville", state: "Kentucky", stateAbbr: "KY" },
  { name: "Baltimore", state: "Maryland", stateAbbr: "MD" },
  { name: "Milwaukee", state: "Wisconsin", stateAbbr: "WI" },
  { name: "Albuquerque", state: "New Mexico", stateAbbr: "NM" },
  { name: "Fresno", state: "California", stateAbbr: "CA" },
  { name: "Tucson", state: "Arizona", stateAbbr: "AZ" },
  { name: "Sacramento", state: "California", stateAbbr: "CA" },
  { name: "Mesa", state: "Arizona", stateAbbr: "AZ" },
  { name: "Kansas City", state: "Missouri", stateAbbr: "MO" },
  { name: "Atlanta", state: "Georgia", stateAbbr: "GA" },
  { name: "Colorado Springs", state: "Colorado", stateAbbr: "CO" },
  { name: "Omaha", state: "Nebraska", stateAbbr: "NE" },
  { name: "Raleigh", state: "North Carolina", stateAbbr: "NC" },
  { name: "Long Beach", state: "California", stateAbbr: "CA" },
  { name: "Virginia Beach", state: "Virginia", stateAbbr: "VA" },
  { name: "Oakland", state: "California", stateAbbr: "CA" },
  { name: "Minneapolis", state: "Minnesota", stateAbbr: "MN" },
  { name: "Tulsa", state: "Oklahoma", stateAbbr: "OK" },
  { name: "Arlington", state: "Texas", stateAbbr: "TX" },
  { name: "Tampa", state: "Florida", stateAbbr: "FL" },
  { name: "Aurora", state: "Colorado", stateAbbr: "CO" },
  { name: "New Orleans", state: "Louisiana", stateAbbr: "LA" },
  { name: "Wichita", state: "Kansas", stateAbbr: "KS" },
  { name: "Cleveland", state: "Ohio", stateAbbr: "OH" },
  { name: "Bakersfield", state: "California", stateAbbr: "CA" },
  { name: "Anaheim", state: "California", stateAbbr: "CA" },
  { name: "Honolulu", state: "Hawaii", stateAbbr: "HI" },
  { name: "Santa Ana", state: "California", stateAbbr: "CA" },
  { name: "Riverside", state: "California", stateAbbr: "CA" },
  { name: "Stockton", state: "California", stateAbbr: "CA" },
  { name: "Lexington", state: "Kentucky", stateAbbr: "KY" },
  { name: "Corpus Christi", state: "Texas", stateAbbr: "TX" },
  { name: "Henderson", state: "Nevada", stateAbbr: "NV" },
  { name: "Anchorage", state: "Alaska", stateAbbr: "AK" },
  { name: "Plano", state: "Texas", stateAbbr: "TX" },
  { name: "St. Louis", state: "Missouri", stateAbbr: "MO" },
  { name: "Lincoln", state: "Nebraska", stateAbbr: "NE" },
  { name: "Orlando", state: "Florida", stateAbbr: "FL" },
  { name: "Irvine", state: "California", stateAbbr: "CA" },
  { name: "Jersey City", state: "New Jersey", stateAbbr: "NJ" },
  { name: "Chula Vista", state: "California", stateAbbr: "CA" },
  { name: "Durham", state: "North Carolina", stateAbbr: "NC" },
  { name: "Fort Wayne", state: "Indiana", stateAbbr: "IN" },
  { name: "St. Paul", state: "Minnesota", stateAbbr: "MN" },
  { name: "Laredo", state: "Texas", stateAbbr: "TX" },
  { name: "Garland", state: "Texas", stateAbbr: "TX" },
  { name: "North Las Vegas", state: "Nevada", stateAbbr: "NV" },
  { name: "Buffalo", state: "New York", stateAbbr: "NY" },
  { name: "Gilbert", state: "Arizona", stateAbbr: "AZ" },
  { name: "Reno", state: "Nevada", stateAbbr: "NV" },
  { name: "Chesapeake", state: "Virginia", stateAbbr: "VA" },
  { name: "Scottsdale", state: "Arizona", stateAbbr: "AZ" },
  { name: "Glendale", state: "Arizona", stateAbbr: "AZ" },
  { name: "Enterprise", state: "Nevada", stateAbbr: "NV" },
  { name: "Winston-Salem", state: "North Carolina", stateAbbr: "NC" },
  { name: "Toledo", state: "Ohio", stateAbbr: "OH" },
  { name: "Pittsburgh", state: "Pennsylvania", stateAbbr: "PA" },
  { name: "Newark", state: "New Jersey", stateAbbr: "NJ" },
  { name: "Madison", state: "Wisconsin", stateAbbr: "WI" }
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
  stateSlug: city.stateAbbr.toLowerCase()
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
