import { City } from '@/types/directory';

const cityData = [
  // Alabama
  { name: "Birmingham", state: "Alabama", stateAbbr: "AL" },
  { name: "Montgomery", state: "Alabama", stateAbbr: "AL" },
  { name: "Mobile", state: "Alabama", stateAbbr: "AL" },
  { name: "Huntsville", state: "Alabama", stateAbbr: "AL" },
  { name: "Tuscaloosa", state: "Alabama", stateAbbr: "AL" },
  
  // Alaska
  { name: "Anchorage", state: "Alaska", stateAbbr: "AK" },
  { name: "Fairbanks", state: "Alaska", stateAbbr: "AK" },
  { name: "Juneau", state: "Alaska", stateAbbr: "AK" },
  
  // Arizona
  { name: "Phoenix", state: "Arizona", stateAbbr: "AZ" },
  { name: "Tucson", state: "Arizona", stateAbbr: "AZ" },
  { name: "Mesa", state: "Arizona", stateAbbr: "AZ" },
  { name: "Chandler", state: "Arizona", stateAbbr: "AZ" },
  { name: "Scottsdale", state: "Arizona", stateAbbr: "AZ" },
  { name: "Glendale", state: "Arizona", stateAbbr: "AZ" },
  { name: "Gilbert", state: "Arizona", stateAbbr: "AZ" },
  { name: "Tempe", state: "Arizona", stateAbbr: "AZ" },
  { name: "West Valley", state: "Arizona", stateAbbr: "AZ" },
  { name: "Wickenburg", state: "Arizona", stateAbbr: "AZ" },
  
  // Arkansas
  { name: "Little Rock", state: "Arkansas", stateAbbr: "AR" },
  { name: "Fort Smith", state: "Arkansas", stateAbbr: "AR" },
  { name: "Fayetteville", state: "Arkansas", stateAbbr: "AR" },
  
  // California
  { name: "Los Angeles", state: "California", stateAbbr: "CA" },
  { name: "San Diego", state: "California", stateAbbr: "CA" },
  { name: "San Jose", state: "California", stateAbbr: "CA" },
  { name: "San Francisco", state: "California", stateAbbr: "CA" },
  { name: "Fresno", state: "California", stateAbbr: "CA" },
  { name: "Sacramento", state: "California", stateAbbr: "CA" },
  { name: "Long Beach", state: "California", stateAbbr: "CA" },
  { name: "Oakland", state: "California", stateAbbr: "CA" },
  { name: "Bakersfield", state: "California", stateAbbr: "CA" },
  { name: "Anaheim", state: "California", stateAbbr: "CA" },
  { name: "Santa Ana", state: "California", stateAbbr: "CA" },
  { name: "Riverside", state: "California", stateAbbr: "CA" },
  { name: "Stockton", state: "California", stateAbbr: "CA" },
  { name: "Irvine", state: "California", stateAbbr: "CA" },
  { name: "Chula Vista", state: "California", stateAbbr: "CA" },
  
  // Colorado
  { name: "Denver", state: "Colorado", stateAbbr: "CO" },
  { name: "Colorado Springs", state: "Colorado", stateAbbr: "CO" },
  { name: "Aurora", state: "Colorado", stateAbbr: "CO" },
  { name: "Fort Collins", state: "Colorado", stateAbbr: "CO" },
  
  // Connecticut
  { name: "Bridgeport", state: "Connecticut", stateAbbr: "CT" },
  { name: "New Haven", state: "Connecticut", stateAbbr: "CT" },
  { name: "Stamford", state: "Connecticut", stateAbbr: "CT" },
  { name: "Hartford", state: "Connecticut", stateAbbr: "CT" },
  
  // Delaware
  { name: "Wilmington", state: "Delaware", stateAbbr: "DE" },
  { name: "Dover", state: "Delaware", stateAbbr: "DE" },
  
  // Florida
  { name: "Jacksonville", state: "Florida", stateAbbr: "FL" },
  { name: "Miami", state: "Florida", stateAbbr: "FL" },
  { name: "Tampa", state: "Florida", stateAbbr: "FL" },
  { name: "Orlando", state: "Florida", stateAbbr: "FL" },
  { name: "St. Petersburg", state: "Florida", stateAbbr: "FL" },
  { name: "Hialeah", state: "Florida", stateAbbr: "FL" },
  { name: "Tallahassee", state: "Florida", stateAbbr: "FL" },
  { name: "Fort Lauderdale", state: "Florida", stateAbbr: "FL" },
  { name: "Port St. Lucie", state: "Florida", stateAbbr: "FL" },
  { name: "Cape Coral", state: "Florida", stateAbbr: "FL" },
  { name: "Pembroke Pines", state: "Florida", stateAbbr: "FL" },
  
  // Georgia
  { name: "Atlanta", state: "Georgia", stateAbbr: "GA" },
  { name: "Augusta", state: "Georgia", stateAbbr: "GA" },
  { name: "Columbus", state: "Georgia", stateAbbr: "GA" },
  { name: "Savannah", state: "Georgia", stateAbbr: "GA" },
  { name: "Athens", state: "Georgia", stateAbbr: "GA" },
  
  // Hawaii
  { name: "Honolulu", state: "Hawaii", stateAbbr: "HI" },
  
  // Idaho
  { name: "Boise", state: "Idaho", stateAbbr: "ID" },
  { name: "Meridian", state: "Idaho", stateAbbr: "ID" },
  { name: "Nampa", state: "Idaho", stateAbbr: "ID" },
  
  // Illinois
  { name: "Chicago", state: "Illinois", stateAbbr: "IL" },
  { name: "Aurora", state: "Illinois", stateAbbr: "IL" },
  { name: "Naperville", state: "Illinois", stateAbbr: "IL" },
  { name: "Joliet", state: "Illinois", stateAbbr: "IL" },
  { name: "Rockford", state: "Illinois", stateAbbr: "IL" },
  
  // Indiana
  { name: "Indianapolis", state: "Indiana", stateAbbr: "IN" },
  { name: "Fort Wayne", state: "Indiana", stateAbbr: "IN" },
  { name: "Evansville", state: "Indiana", stateAbbr: "IN" },
  { name: "South Bend", state: "Indiana", stateAbbr: "IN" },
  
  // Iowa
  { name: "Des Moines", state: "Iowa", stateAbbr: "IA" },
  { name: "Cedar Rapids", state: "Iowa", stateAbbr: "IA" },
  { name: "Davenport", state: "Iowa", stateAbbr: "IA" },
  
  // Kansas
  { name: "Wichita", state: "Kansas", stateAbbr: "KS" },
  { name: "Overland Park", state: "Kansas", stateAbbr: "KS" },
  { name: "Kansas City", state: "Kansas", stateAbbr: "KS" },
  
  // Kentucky
  { name: "Louisville", state: "Kentucky", stateAbbr: "KY" },
  { name: "Lexington", state: "Kentucky", stateAbbr: "KY" },
  
  // Louisiana
  { name: "New Orleans", state: "Louisiana", stateAbbr: "LA" },
  { name: "Baton Rouge", state: "Louisiana", stateAbbr: "LA" },
  { name: "Shreveport", state: "Louisiana", stateAbbr: "LA" },
  
  // Maine
  { name: "Portland", state: "Maine", stateAbbr: "ME" },
  
  // Maryland
  { name: "Baltimore", state: "Maryland", stateAbbr: "MD" },
  
  // Massachusetts
  { name: "Boston", state: "Massachusetts", stateAbbr: "MA" },
  { name: "Worcester", state: "Massachusetts", stateAbbr: "MA" },
  { name: "Springfield", state: "Massachusetts", stateAbbr: "MA" },
  
  // Michigan
  { name: "Detroit", state: "Michigan", stateAbbr: "MI" },
  { name: "Grand Rapids", state: "Michigan", stateAbbr: "MI" },
  { name: "Warren", state: "Michigan", stateAbbr: "MI" },
  { name: "Sterling Heights", state: "Michigan", stateAbbr: "MI" },
  { name: "Ann Arbor", state: "Michigan", stateAbbr: "MI" },
  
  // Minnesota
  { name: "Minneapolis", state: "Minnesota", stateAbbr: "MN" },
  { name: "St. Paul", state: "Minnesota", stateAbbr: "MN" },
  { name: "Rochester", state: "Minnesota", stateAbbr: "MN" },
  
  // Mississippi
  { name: "Jackson", state: "Mississippi", stateAbbr: "MS" },
  { name: "Gulfport", state: "Mississippi", stateAbbr: "MS" },
  
  // Missouri
  { name: "Kansas City", state: "Missouri", stateAbbr: "MO" },
  { name: "St. Louis", state: "Missouri", stateAbbr: "MO" },
  { name: "Springfield", state: "Missouri", stateAbbr: "MO" },
  
  // Montana
  { name: "Billings", state: "Montana", stateAbbr: "MT" },
  { name: "Missoula", state: "Montana", stateAbbr: "MT" },
  
  // Nebraska
  { name: "Omaha", state: "Nebraska", stateAbbr: "NE" },
  { name: "Lincoln", state: "Nebraska", stateAbbr: "NE" },
  
  // Nevada
  { name: "Las Vegas", state: "Nevada", stateAbbr: "NV" },
  { name: "Henderson", state: "Nevada", stateAbbr: "NV" },
  { name: "Reno", state: "Nevada", stateAbbr: "NV" },
  { name: "North Las Vegas", state: "Nevada", stateAbbr: "NV" },
  { name: "Enterprise", state: "Nevada", stateAbbr: "NV" },
  
  // New Hampshire
  { name: "Manchester", state: "New Hampshire", stateAbbr: "NH" },
  { name: "Nashua", state: "New Hampshire", stateAbbr: "NH" },
  
  // New Jersey
  { name: "Newark", state: "New Jersey", stateAbbr: "NJ" },
  { name: "Jersey City", state: "New Jersey", stateAbbr: "NJ" },
  { name: "Paterson", state: "New Jersey", stateAbbr: "NJ" },
  { name: "Elizabeth", state: "New Jersey", stateAbbr: "NJ" },
  
  // New Mexico
  { name: "Albuquerque", state: "New Mexico", stateAbbr: "NM" },
  { name: "Las Cruces", state: "New Mexico", stateAbbr: "NM" },
  
  // New York
  { name: "New York", state: "New York", stateAbbr: "NY" },
  { name: "Buffalo", state: "New York", stateAbbr: "NY" },
  { name: "Rochester", state: "New York", stateAbbr: "NY" },
  { name: "Yonkers", state: "New York", stateAbbr: "NY" },
  { name: "Syracuse", state: "New York", stateAbbr: "NY" },
  
  // North Carolina
  { name: "Charlotte", state: "North Carolina", stateAbbr: "NC" },
  { name: "Raleigh", state: "North Carolina", stateAbbr: "NC" },
  { name: "Greensboro", state: "North Carolina", stateAbbr: "NC" },
  { name: "Durham", state: "North Carolina", stateAbbr: "NC" },
  { name: "Winston-Salem", state: "North Carolina", stateAbbr: "NC" },
  { name: "Fayetteville", state: "North Carolina", stateAbbr: "NC" },
  
  // North Dakota
  { name: "Fargo", state: "North Dakota", stateAbbr: "ND" },
  { name: "Bismarck", state: "North Dakota", stateAbbr: "ND" },
  
  // Ohio
  { name: "Columbus", state: "Ohio", stateAbbr: "OH" },
  { name: "Cleveland", state: "Ohio", stateAbbr: "OH" },
  { name: "Cincinnati", state: "Ohio", stateAbbr: "OH" },
  { name: "Toledo", state: "Ohio", stateAbbr: "OH" },
  { name: "Akron", state: "Ohio", stateAbbr: "OH" },
  
  // Oklahoma
  { name: "Oklahoma City", state: "Oklahoma", stateAbbr: "OK" },
  { name: "Tulsa", state: "Oklahoma", stateAbbr: "OK" },
  { name: "Norman", state: "Oklahoma", stateAbbr: "OK" },
  
  // Oregon
  { name: "Portland", state: "Oregon", stateAbbr: "OR" },
  { name: "Eugene", state: "Oregon", stateAbbr: "OR" },
  { name: "Salem", state: "Oregon", stateAbbr: "OR" },
  
  // Pennsylvania
  { name: "Philadelphia", state: "Pennsylvania", stateAbbr: "PA" },
  { name: "Pittsburgh", state: "Pennsylvania", stateAbbr: "PA" },
  { name: "Allentown", state: "Pennsylvania", stateAbbr: "PA" },
  
  // Rhode Island
  { name: "Providence", state: "Rhode Island", stateAbbr: "RI" },
  
  // South Carolina
  { name: "Columbia", state: "South Carolina", stateAbbr: "SC" },
  { name: "Charleston", state: "South Carolina", stateAbbr: "SC" },
  { name: "North Charleston", state: "South Carolina", stateAbbr: "SC" },
  
  // South Dakota
  { name: "Sioux Falls", state: "South Dakota", stateAbbr: "SD" },
  { name: "Rapid City", state: "South Dakota", stateAbbr: "SD" },
  
  // Tennessee
  { name: "Nashville", state: "Tennessee", stateAbbr: "TN" },
  { name: "Memphis", state: "Tennessee", stateAbbr: "TN" },
  { name: "Knoxville", state: "Tennessee", stateAbbr: "TN" },
  { name: "Chattanooga", state: "Tennessee", stateAbbr: "TN" },
  
  // Texas
  { name: "Houston", state: "Texas", stateAbbr: "TX" },
  { name: "San Antonio", state: "Texas", stateAbbr: "TX" },
  { name: "Dallas", state: "Texas", stateAbbr: "TX" },
  { name: "Austin", state: "Texas", stateAbbr: "TX" },
  { name: "Fort Worth", state: "Texas", stateAbbr: "TX" },
  { name: "El Paso", state: "Texas", stateAbbr: "TX" },
  { name: "Arlington", state: "Texas", stateAbbr: "TX" },
  { name: "Corpus Christi", state: "Texas", stateAbbr: "TX" },
  { name: "Plano", state: "Texas", stateAbbr: "TX" },
  { name: "Laredo", state: "Texas", stateAbbr: "TX" },
  { name: "Garland", state: "Texas", stateAbbr: "TX" },
  { name: "Irving", state: "Texas", stateAbbr: "TX" },
  
  // Utah
  { name: "Salt Lake City", state: "Utah", stateAbbr: "UT" },
  { name: "West Valley City", state: "Utah", stateAbbr: "UT" },
  { name: "Provo", state: "Utah", stateAbbr: "UT" },
  
  // Vermont
  { name: "Burlington", state: "Vermont", stateAbbr: "VT" },
  
  // Virginia
  { name: "Virginia Beach", state: "Virginia", stateAbbr: "VA" },
  { name: "Norfolk", state: "Virginia", stateAbbr: "VA" },
  { name: "Chesapeake", state: "Virginia", stateAbbr: "VA" },
  { name: "Richmond", state: "Virginia", stateAbbr: "VA" },
  
  // Washington
  { name: "Seattle", state: "Washington", stateAbbr: "WA" },
  { name: "Spokane", state: "Washington", stateAbbr: "WA" },
  { name: "Tacoma", state: "Washington", stateAbbr: "WA" },
  
  // Washington DC
  { name: "Washington", state: "District of Columbia", stateAbbr: "DC" },
  
  // West Virginia
  { name: "Charleston", state: "West Virginia", stateAbbr: "WV" },
  { name: "Huntington", state: "West Virginia", stateAbbr: "WV" },
  
  // Wisconsin
  { name: "Milwaukee", state: "Wisconsin", stateAbbr: "WI" },
  { name: "Madison", state: "Wisconsin", stateAbbr: "WI" },
  { name: "Green Bay", state: "Wisconsin", stateAbbr: "WI" },
  
  // Wyoming
  { name: "Cheyenne", state: "Wyoming", stateAbbr: "WY" },
  { name: "Casper", state: "Wyoming", stateAbbr: "WY" }
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
      // Accept both full state name slug (e.g., 'arizona') and abbreviation slug (e.g., 'az')
      const normalizedStateSlug = stateSlug.toLowerCase();
      const matchesState = city.stateSlug === normalizedStateSlug || 
        city.state.toLowerCase().replace(/\s+/g, '-') === normalizedStateSlug;
      return city.slug === citySlug && matchesState;
    }
    return city.slug === citySlug;
  });
}

export function getCitiesByState(stateSlug: string): City[] {
  return cities.filter(city => city.stateSlug === stateSlug);
}
