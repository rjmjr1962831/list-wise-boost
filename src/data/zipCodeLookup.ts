export interface ZipCodeData {
  city: string;
  state: string;
  zip_codes: Array<{
    zip: string;
    population: number;
    median_income: number;
    median_home_value: number;
    marketing_value: number;
    notes: string;
  }>;
}

export const zipCodeData: ZipCodeData[] = [
  {
    city: "Birmingham",
    state: "Alabama",
    zip_codes: [
      {zip: "35203", population: 12000, median_income: 42000, median_home_value: 150000, marketing_value: 2, notes: "Downtown mixed use"},
      {zip: "35213", population: 25000, median_income: 85000, median_home_value: 350000, marketing_value: 5, notes: "Mountain Brook area luxury homes"},
      {zip: "35223", population: 18000, median_income: 65000, median_home_value: 250000, marketing_value: 4, notes: "Homewood strong market"},
      {zip: "35242", population: 15000, median_income: 52000, median_home_value: 200000, marketing_value: 3, notes: "Growing suburban"}
    ]
  },
  {
    city: "Montgomery",
    state: "Alabama",
    zip_codes: [
      {zip: "36104", population: 8000, median_income: 35000, median_home_value: 120000, marketing_value: 2, notes: "Downtown area"},
      {zip: "36117", population: 22000, median_income: 72000, median_home_value: 280000, marketing_value: 5, notes: "East Montgomery high demand"},
      {zip: "36116", population: 16000, median_income: 48000, median_home_value: 180000, marketing_value: 3, notes: "West side residential"}
    ]
  },
  {
    city: "Mobile",
    state: "Alabama",
    zip_codes: [
      {zip: "36608", population: 14000, median_income: 58000, median_home_value: 220000, marketing_value: 4, notes: "West Mobile family area"},
      {zip: "36695", population: 18000, median_income: 68000, median_home_value: 260000, marketing_value: 4, notes: "Spring Hill upscale"},
      {zip: "36606", population: 12000, median_income: 38000, median_home_value: 140000, marketing_value: 2, notes: "Lower demand area"}
    ]
  },
  {
    city: "Huntsville",
    state: "Alabama",
    zip_codes: [
      {zip: "35801", population: 10000, median_income: 45000, median_home_value: 170000, marketing_value: 3, notes: "Downtown revitalization"},
      {zip: "35806", population: 28000, median_income: 82000, median_home_value: 320000, marketing_value: 5, notes: "Jones Valley tech workers"},
      {zip: "35824", population: 24000, median_income: 78000, median_home_value: 300000, marketing_value: 5, notes: "Research Park area"}
    ]
  },
  {
    city: "Tuscaloosa",
    state: "Alabama",
    zip_codes: [
      {zip: "35401", population: 15000, median_income: 42000, median_home_value: 160000, marketing_value: 3, notes: "Near University of Alabama"},
      {zip: "35406", population: 20000, median_income: 58000, median_home_value: 220000, marketing_value: 4, notes: "Northport area"}
    ]
  },
  {
    city: "Fairbanks",
    state: "Alaska",
    zip_codes: [
      {zip: "99701", population: 15000, median_income: 68000, median_home_value: 260000, marketing_value: 3, notes: "Downtown Fairbanks"},
      {zip: "99709", population: 18000, median_income: 82000, median_home_value: 320000, marketing_value: 4, notes: "Military Eielson area"}
    ]
  },
  {
    city: "Juneau",
    state: "Alaska",
    zip_codes: [
      {zip: "99801", population: 22000, median_income: 88000, median_home_value: 340000, marketing_value: 4, notes: "Capital city government workers"},
      {zip: "99803", population: 8000, median_income: 72000, median_home_value: 280000, marketing_value: 3, notes: "Douglas Island"}
    ]
  },
  {
    city: "Chandler",
    state: "Arizona",
    zip_codes: [
      {zip: "85224", population: 35000, median_income: 85000, median_home_value: 330000, marketing_value: 5, notes: "Ocotillo new developments"},
      {zip: "85225", population: 42000, median_income: 98000, median_home_value: 380000, marketing_value: 5, notes: "High-end tech sector"},
      {zip: "85226", population: 28000, median_income: 72000, median_home_value: 280000, marketing_value: 4, notes: "Established neighborhoods"}
    ]
  },
  {
    city: "Tempe",
    state: "Arizona",
    zip_codes: [
      {zip: "85281", population: 25000, median_income: 52000, median_home_value: 200000, marketing_value: 3, notes: "Near ASU rentals"},
      {zip: "85284", population: 32000, median_income: 92000, median_home_value: 360000, marketing_value: 5, notes: "South Tempe premium"},
      {zip: "85282", population: 28000, median_income: 68000, median_home_value: 260000, marketing_value: 4, notes: "Central Tempe"}
    ]
  },
  {
    city: "West Valley",
    state: "Arizona",
    zip_codes: [
      {zip: "85383", population: 38000, median_income: 65000, median_home_value: 250000, marketing_value: 4, notes: "Peoria area growing"},
      {zip: "85345", population: 32000, median_income: 58000, median_home_value: 220000, marketing_value: 3, notes: "Glendale west"}
    ]
  },
  {
    city: "Little Rock",
    state: "Arkansas",
    zip_codes: [
      {zip: "72202", population: 8000, median_income: 42000, median_home_value: 160000, marketing_value: 2, notes: "Downtown"},
      {zip: "72211", population: 22000, median_income: 78000, median_home_value: 300000, marketing_value: 5, notes: "West Little Rock upscale"},
      {zip: "72223", population: 18000, median_income: 72000, median_home_value: 280000, marketing_value: 4, notes: "Maumelle area"}
    ]
  },
  {
    city: "Fort Smith",
    state: "Arkansas",
    zip_codes: [
      {zip: "72901", population: 12000, median_income: 38000, median_home_value: 140000, marketing_value: 2, notes: "Central city"},
      {zip: "72903", population: 16000, median_income: 52000, median_home_value: 200000, marketing_value: 3, notes: "East side residential"}
    ]
  },
  {
    city: "Fayetteville",
    state: "Arkansas",
    zip_codes: [
      {zip: "72701", population: 18000, median_income: 58000, median_home_value: 220000, marketing_value: 4, notes: "Near University of Arkansas"},
      {zip: "72704", population: 24000, median_income: 68000, median_home_value: 260000, marketing_value: 4, notes: "Northwest growth area"}
    ]
  },
  {
    city: "Fort Collins",
    state: "Colorado",
    zip_codes: [
      {zip: "80521", population: 32000, median_income: 78000, median_home_value: 300000, marketing_value: 5, notes: "South Fort Collins"},
      {zip: "80526", population: 28000, median_income: 88000, median_home_value: 340000, marketing_value: 5, notes: "Southwest CSU area"},
      {zip: "80528", population: 22000, median_income: 72000, median_home_value: 280000, marketing_value: 4, notes: "East side"}
    ]
  },
  {
    city: "Bridgeport",
    state: "Connecticut",
    zip_codes: [
      {zip: "06604", population: 18000, median_income: 45000, median_home_value: 170000, marketing_value: 3, notes: "North end"},
      {zip: "06606", population: 15000, median_income: 42000, median_home_value: 160000, marketing_value: 2, notes: "East side"}
    ]
  },
  {
    city: "New Haven",
    state: "Connecticut",
    zip_codes: [
      {zip: "06510", population: 12000, median_income: 48000, median_home_value: 180000, marketing_value: 3, notes: "East Rock area"},
      {zip: "06511", population: 22000, median_income: 72000, median_home_value: 280000, marketing_value: 4, notes: "Westville near Yale"},
      {zip: "06515", population: 16000, median_income: 55000, median_home_value: 210000, marketing_value: 3, notes: "Amity area"}
    ]
  },
  {
    city: "Stamford",
    state: "Connecticut",
    zip_codes: [
      {zip: "06902", population: 25000, median_income: 95000, median_home_value: 370000, marketing_value: 5, notes: "Downtown commuters"},
      {zip: "06903", population: 18000, median_income: 88000, median_home_value: 340000, marketing_value: 5, notes: "Waterside"},
      {zip: "06905", population: 20000, median_income: 82000, median_home_value: 320000, marketing_value: 4, notes: "North Stamford"}
    ]
  },
  {
    city: "Hartford",
    state: "Connecticut",
    zip_codes: [
      {zip: "06106", population: 14000, median_income: 38000, median_home_value: 140000, marketing_value: 2, notes: "Central city"},
      {zip: "06107", population: 18000, median_income: 52000, median_home_value: 200000, marketing_value: 3, notes: "West Hartford border"}
    ]
  },
  {
    city: "Wilmington",
    state: "Delaware",
    zip_codes: [
      {zip: "19801", population: 15000, median_income: 48000, median_home_value: 180000, marketing_value: 3, notes: "Downtown"},
      {zip: "19803", population: 20000, median_income: 82000, median_home_value: 320000, marketing_value: 5, notes: "Greenville area upscale"},
      {zip: "19805", population: 12000, median_income: 58000, median_home_value: 220000, marketing_value: 3, notes: "Northeast"}
    ]
  },
  {
    city: "Dover",
    state: "Delaware",
    zip_codes: [
      {zip: "19901", population: 18000, median_income: 52000, median_home_value: 200000, marketing_value: 3, notes: "Central Dover"},
      {zip: "19904", population: 14000, median_income: 58000, median_home_value: 220000, marketing_value: 3, notes: "South Dover"}
    ]
  },
  {
    city: "Miami",
    state: "Florida",
    zip_codes: [
      {zip: "33133", population: 28000, median_income: 125000, median_home_value: 850000, marketing_value: 5, notes: "Coral Gables luxury"},
      {zip: "33139", population: 35000, median_income: 72000, median_home_value: 520000, marketing_value: 4, notes: "Miami Beach"},
      {zip: "33176", population: 42000, median_income: 62000, median_home_value: 380000, marketing_value: 4, notes: "West Kendall families"},
      {zip: "33145", population: 32000, median_income: 58000, median_home_value: 350000, marketing_value: 3, notes: "Little Havana area"},
      {zip: "33186", population: 38000, median_income: 68000, median_home_value: 420000, marketing_value: 4, notes: "South Miami"}
    ]
  },
  {
    city: "St. Petersburg",
    state: "Florida",
    zip_codes: [
      {zip: "33701", population: 18000, median_income: 55000, median_home_value: 280000, marketing_value: 3, notes: "Downtown"},
      {zip: "33706", population: 25000, median_income: 78000, median_home_value: 420000, marketing_value: 5, notes: "Northeast waterfront"},
      {zip: "33710", population: 22000, median_income: 65000, median_home_value: 350000, marketing_value: 4, notes: "Central"}
    ]
  },
  {
    city: "Hialeah",
    state: "Florida",
    zip_codes: [
      {zip: "33010", population: 35000, median_income: 42000, median_home_value: 280000, marketing_value: 3, notes: "Central Hialeah"},
      {zip: "33016", population: 32000, median_income: 48000, median_home_value: 310000, marketing_value: 3, notes: "Northwest"}
    ]
  },
  {
    city: "Tallahassee",
    state: "Florida",
    zip_codes: [
      {zip: "32301", population: 12000, median_income: 38000, median_home_value: 180000, marketing_value: 2, notes: "Downtown"},
      {zip: "32312", population: 28000, median_income: 72000, median_home_value: 350000, marketing_value: 5, notes: "Northeast upscale"},
      {zip: "32308", population: 24000, median_income: 58000, median_home_value: 280000, marketing_value: 4, notes: "Near FSU"}
    ]
  },
  {
    city: "Fort Lauderdale",
    state: "Florida",
    zip_codes: [
      {zip: "33301", population: 15000, median_income: 62000, median_home_value: 380000, marketing_value: 4, notes: "Downtown"},
      {zip: "33304", population: 22000, median_income: 88000, median_home_value: 520000, marketing_value: 5, notes: "Victoria Park"},
      {zip: "33315", population: 28000, median_income: 52000, median_home_value: 310000, marketing_value: 3, notes: "West Fort Lauderdale"}
    ]
  },
  {
    city: "Port St. Lucie",
    state: "Florida",
    zip_codes: [
      {zip: "34952", population: 32000, median_income: 58000, median_home_value: 280000, marketing_value: 4, notes: "Central area"},
      {zip: "34986", population: 28000, median_income: 62000, median_home_value: 310000, marketing_value: 4, notes: "Southwest growth"}
    ]
  },
  {
    city: "Cape Coral",
    state: "Florida",
    zip_codes: [
      {zip: "33904", population: 35000, median_income: 58000, median_home_value: 280000, marketing_value: 4, notes: "Southwest"},
      {zip: "33914", population: 42000, median_income: 65000, median_home_value: 320000, marketing_value: 4, notes: "Southeast waterfront"}
    ]
  },
  {
    city: "Pembroke Pines",
    state: "Florida",
    zip_codes: [
      {zip: "33024", population: 32000, median_income: 68000, median_home_value: 350000, marketing_value: 4, notes: "Central"},
      {zip: "33028", population: 28000, median_income: 72000, median_home_value: 380000, marketing_value: 4, notes: "West"}
    ]
  },
  {
    city: "Augusta",
    state: "Georgia",
    zip_codes: [
      {zip: "30901", population: 12000, median_income: 38000, median_home_value: 140000, marketing_value: 2, notes: "Downtown"},
      {zip: "30909", population: 22000, median_income: 68000, median_home_value: 260000, marketing_value: 4, notes: "West Augusta"}
    ]
  },
  {
    city: "Columbus",
    state: "Georgia",
    zip_codes: [
      {zip: "31901", population: 15000, median_income: 42000, median_home_value: 160000, marketing_value: 3, notes: "Downtown"},
      {zip: "31904", population: 25000, median_income: 72000, median_home_value: 280000, marketing_value: 5, notes: "North Columbus"}
    ]
  },
  {
    city: "Savannah",
    state: "Georgia",
    zip_codes: [
      {zip: "31401", population: 18000, median_income: 55000, median_home_value: 280000, marketing_value: 4, notes: "Historic district"},
      {zip: "31419", population: 28000, median_income: 68000, median_home_value: 320000, marketing_value: 4, notes: "South side"}
    ]
  },
  {
    city: "Athens",
    state: "Georgia",
    zip_codes: [
      {zip: "30601", population: 15000, median_income: 42000, median_home_value: 220000, marketing_value: 3, notes: "Downtown"},
      {zip: "30605", population: 22000, median_income: 62000, median_home_value: 280000, marketing_value: 4, notes: "West side"}
    ]
  },
  {
    city: "Boise",
    state: "Idaho",
    zip_codes: [
      {zip: "83702", population: 22000, median_income: 68000, median_home_value: 380000, marketing_value: 4, notes: "Downtown"},
      {zip: "83704", population: 32000, median_income: 78000, median_home_value: 420000, marketing_value: 5, notes: "Northwest"}
    ]
  },
  {
    city: "Meridian",
    state: "Idaho",
    zip_codes: [
      {zip: "83642", population: 38000, median_income: 82000, median_home_value: 450000, marketing_value: 5, notes: "Central Meridian"}
    ]
  },
  {
    city: "Nampa",
    state: "Idaho",
    zip_codes: [
      {zip: "83651", population: 28000, median_income: 58000, median_home_value: 280000, marketing_value: 3, notes: "Central Nampa"}
    ]
  },
  {
    city: "Aurora",
    state: "Illinois",
    zip_codes: [
      {zip: "60502", population: 28000, median_income: 68000, median_home_value: 280000, marketing_value: 4, notes: "Central"},
      {zip: "60504", population: 32000, median_income: 72000, median_home_value: 310000, marketing_value: 4, notes: "West side"}
    ]
  },
  {
    city: "Naperville",
    state: "Illinois",
    zip_codes: [
      {zip: "60540", population: 42000, median_income: 105000, median_home_value: 520000, marketing_value: 5, notes: "West Naperville"},
      {zip: "60564", population: 38000, median_income: 98000, median_home_value: 480000, marketing_value: 5, notes: "South side"}
    ]
  },
  {
    city: "Joliet",
    state: "Illinois",
    zip_codes: [
      {zip: "60435", population: 32000, median_income: 62000, median_home_value: 240000, marketing_value: 3, notes: "West side"},
      {zip: "60431", population: 28000, median_income: 58000, median_home_value: 220000, marketing_value: 3, notes: "South Joliet"}
    ]
  },
  {
    city: "Rockford",
    state: "Illinois",
    zip_codes: [
      {zip: "61107", population: 25000, median_income: 52000, median_home_value: 180000, marketing_value: 3, notes: "East side"},
      {zip: "61114", population: 28000, median_income: 62000, median_home_value: 210000, marketing_value: 3, notes: "Northwest"}
    ]
  },
  {
    city: "Evansville",
    state: "Indiana",
    zip_codes: [
      {zip: "47710", population: 22000, median_income: 58000, median_home_value: 180000, marketing_value: 3, notes: "East side"},
      {zip: "47715", population: 18000, median_income: 52000, median_home_value: 160000, marketing_value: 3, notes: "North side"}
    ]
  },
  {
    city: "South Bend",
    state: "Indiana",
    zip_codes: [
      {zip: "46601", population: 15000, median_income: 42000, median_home_value: 140000, marketing_value: 2, notes: "Downtown"},
      {zip: "46614", population: 22000, median_income: 58000, median_home_value: 180000, marketing_value: 3, notes: "Northeast"}
    ]
  },
  {
    city: "Des Moines",
    state: "Iowa",
    zip_codes: [
      {zip: "50309", population: 18000, median_income: 65000, median_home_value: 280000, marketing_value: 4, notes: "Downtown"},
      {zip: "50311", population: 25000, median_income: 72000, median_home_value: 310000, marketing_value: 4, notes: "West side"}
    ]
  },
  {
    city: "Cedar Rapids",
    state: "Iowa",
    zip_codes: [
      {zip: "52402", population: 22000, median_income: 62000, median_home_value: 200000, marketing_value: 3, notes: "Southwest"},
      {zip: "52403", population: 18000, median_income: 58000, median_home_value: 180000, marketing_value: 3, notes: "Northeast"}
    ]
  },
  {
    city: "Davenport",
    state: "Iowa",
    zip_codes: [
      {zip: "52801", population: 15000, median_income: 48000, median_home_value: 140000, marketing_value: 2, notes: "Downtown"},
      {zip: "52807", population: 22000, median_income: 65000, median_home_value: 210000, marketing_value: 4, notes: "Northwest"}
    ]
  },
  {
    city: "Overland Park",
    state: "Kansas",
    zip_codes: [
      {zip: "66062", population: 35000, median_income: 88000, median_home_value: 380000, marketing_value: 5, notes: "South"},
      {zip: "66223", population: 28000, median_income: 78000, median_home_value: 320000, marketing_value: 4, notes: "Central"}
    ]
  },
  {
    city: "Kansas City",
    state: "Kansas",
    zip_codes: [
      {zip: "66101", population: 18000, median_income: 42000, median_home_value: 140000, marketing_value: 2, notes: "Downtown"},
      {zip: "66109", population: 22000, median_income: 58000, median_home_value: 200000, marketing_value: 3, notes: "West side"}
    ]
  },
  {
    city: "Baton Rouge",
    state: "Louisiana",
    zip_codes: [
      {zip: "70808", population: 28000, median_income: 72000, median_home_value: 280000, marketing_value: 4, notes: "Southeast"},
      {zip: "70810", population: 25000, median_income: 68000, median_home_value: 260000, marketing_value: 4, notes: "Central"}
    ]
  },
  {
    city: "Shreveport",
    state: "Louisiana",
    zip_codes: [
      {zip: "71104", population: 22000, median_income: 58000, median_home_value: 180000, marketing_value: 3, notes: "South side"},
      {zip: "71106", population: 18000, median_income: 52000, median_home_value: 160000, marketing_value: 3, notes: "West"}
    ]
  },
  {
    city: "Portland",
    state: "Maine",
    zip_codes: [
      {zip: "04101", population: 15000, median_income: 55000, median_home_value: 380000, marketing_value: 4, notes: "Downtown"},
      {zip: "04102", population: 18000, median_income: 62000, median_home_value: 420000, marketing_value: 4, notes: "West End"}
    ]
  },
  {
    city: "Worcester",
    state: "Massachusetts",
    zip_codes: [
      {zip: "01605", population: 25000, median_income: 58000, median_home_value: 280000, marketing_value: 3, notes: "West side"},
      {zip: "01609", population: 22000, median_income: 65000, median_home_value: 320000, marketing_value: 4, notes: "Southeast"}
    ]
  },
  {
    city: "Springfield",
    state: "Massachusetts",
    zip_codes: [
      {zip: "01118", population: 18000, median_income: 48000, median_home_value: 180000, marketing_value: 3, notes: "East Forest Park"},
      {zip: "01128", population: 15000, median_income: 52000, median_home_value: 200000, marketing_value: 3, notes: "East Springfield"}
    ]
  },
  {
    city: "Grand Rapids",
    state: "Michigan",
    zip_codes: [
      {zip: "49503", population: 18000, median_income: 58000, median_home_value: 220000, marketing_value: 3, notes: "Downtown"},
      {zip: "49546", population: 28000, median_income: 72000, median_home_value: 280000, marketing_value: 4, notes: "East Grand Rapids"}
    ]
  },
  {
    city: "Warren",
    state: "Michigan",
    zip_codes: [
      {zip: "48088", population: 32000, median_income: 62000, median_home_value: 180000, marketing_value: 3, notes: "Southwest"},
      {zip: "48093", population: 28000, median_income: 68000, median_home_value: 200000, marketing_value: 3, notes: "Northeast"}
    ]
  },
  {
    city: "Sterling Heights",
    state: "Michigan",
    zip_codes: [
      {zip: "48310", population: 35000, median_income: 72000, median_home_value: 220000, marketing_value: 4, notes: "Central"},
      {zip: "48312", population: 32000, median_income: 68000, median_home_value: 200000, marketing_value: 3, notes: "North"}
    ]
  },
  {
    city: "Ann Arbor",
    state: "Michigan",
    zip_codes: [
      {zip: "48103", population: 28000, median_income: 78000, median_home_value: 420000, marketing_value: 5, notes: "Central"},
      {zip: "48105", population: 22000, median_income: 65000, median_home_value: 350000, marketing_value: 4, notes: "South side"}
    ]
  },
  {
    city: "Rochester",
    state: "Minnesota",
    zip_codes: [
      {zip: "55901", population: 25000, median_income: 72000, median_home_value: 280000, marketing_value: 4, notes: "Central"},
      {zip: "55904", population: 28000, median_income: 78000, median_home_value: 310000, marketing_value: 5, notes: "Southwest"}
    ]
  },
  {
    city: "Jackson",
    state: "Mississippi",
    zip_codes: [
      {zip: "39206", population: 18000, median_income: 42000, median_home_value: 140000, marketing_value: 2, notes: "Northeast"},
      {zip: "39211", population: 22000, median_income: 68000, median_home_value: 240000, marketing_value: 4, notes: "North Jackson"}
    ]
  },
  {
    city: "Gulfport",
    state: "Mississippi",
    zip_codes: [
      {zip: "39501", population: 22000, median_income: 52000, median_home_value: 180000, marketing_value: 3, notes: "Central"},
      {zip: "39503", population: 18000, median_income: 58000, median_home_value: 200000, marketing_value: 3, notes: "North side"}
    ]
  },
  {
    city: "Springfield",
    state: "Missouri",
    zip_codes: [
      {zip: "65804", population: 25000, median_income: 58000, median_home_value: 180000, marketing_value: 3, notes: "Southeast"},
      {zip: "65810", population: 22000, median_income: 62000, median_home_value: 200000, marketing_value: 3, notes: "South"}
    ]
  },
  {
    city: "Billings",
    state: "Montana",
    zip_codes: [
      {zip: "59101", population: 22000, median_income: 62000, median_home_value: 280000, marketing_value: 4, notes: "Central"},
      {zip: "59102", population: 18000, median_income: 58000, median_home_value: 250000, marketing_value: 3, notes: "West"}
    ]
  },
  {
    city: "Missoula",
    state: "Montana",
    zip_codes: [
      {zip: "59801", population: 18000, median_income: 55000, median_home_value: 380000, marketing_value: 4, notes: "Central"},
      {zip: "59808", population: 15000, median_income: 62000, median_home_value: 420000, marketing_value: 4, notes: "South Hills"}
    ]
  },
  {
    city: "Manchester",
    state: "New Hampshire",
    zip_codes: [
      {zip: "03101", population: 15000, median_income: 52000, median_home_value: 280000, marketing_value: 3, notes: "Downtown"},
      {zip: "03104", population: 22000, median_income: 68000, median_home_value: 350000, marketing_value: 4, notes: "South end"}
    ]
  },
  {
    city: "Nashua",
    state: "New Hampshire",
    zip_codes: [
      {zip: "03060", population: 25000, median_income: 72000, median_home_value: 380000, marketing_value: 4, notes: "Central"},
      {zip: "03063", population: 22000, median_income: 78000, median_home_value: 420000, marketing_value: 5, notes: "South Nashua"}
    ]
  },
  {
    city: "Paterson",
    state: "New Jersey",
    zip_codes: [
      {zip: "07501", population: 28000, median_income: 42000, median_home_value: 280000, marketing_value: 2, notes: "Central"},
      {zip: "07522", population: 22000, median_income: 48000, median_home_value: 310000, marketing_value: 3, notes: "East side"}
    ]
  },
  {
    city: "Elizabeth",
    state: "New Jersey",
    zip_codes: [
      {zip: "07201", population: 32000, median_income: 48000, median_home_value: 320000, marketing_value: 3, notes: "Central"},
      {zip: "07208", population: 28000, median_income: 52000, median_home_value: 350000, marketing_value: 3, notes: "North"}
    ]
  },
  {
    city: "Las Cruces",
    state: "New Mexico",
    zip_codes: [
      {zip: "88001", population: 22000, median_income: 48000, median_home_value: 180000, marketing_value: 3, notes: "Central"},
      {zip: "88011", population: 18000, median_income: 52000, median_home_value: 200000, marketing_value: 3, notes: "East side"}
    ]
  },
  {
    city: "Rochester",
    state: "New York",
    zip_codes: [
      {zip: "14604", population: 12000, median_income: 42000, median_home_value: 140000, marketing_value: 2, notes: "Downtown"},
      {zip: "14620", population: 22000, median_income: 68000, median_home_value: 220000, marketing_value: 4, notes: "South Wedge"}
    ]
  },
  {
    city: "Yonkers",
    state: "New York",
    zip_codes: [
      {zip: "10701", population: 28000, median_income: 58000, median_home_value: 450000, marketing_value: 4, notes: "Central"},
      {zip: "10710", population: 25000, median_income: 72000, median_home_value: 550000, marketing_value: 5, notes: "North Yonkers"}
    ]
  },
  {
    city: "Syracuse",
    state: "New York",
    zip_codes: [
      {zip: "13202", population: 15000, median_income: 42000, median_home_value: 140000, marketing_value: 2, notes: "Downtown"},
      {zip: "13224", population: 22000, median_income: 62000, median_home_value: 180000, marketing_value: 3, notes: "East side"}
    ]
  },
  {
    city: "Greensboro",
    state: "North Carolina",
    zip_codes: [
      {zip: "27403", population: 22000, median_income: 58000, median_home_value: 180000, marketing_value: 3, notes: "Central"},
      {zip: "27410", population: 28000, median_income: 72000, median_home_value: 240000, marketing_value: 4, notes: "Northwest"}
    ]
  },
  {
    city: "Fayetteville",
    state: "North Carolina",
    zip_codes: [
      {zip: "28303", population: 25000, median_income: 52000, median_home_value: 160000, marketing_value: 3, notes: "Central"},
      {zip: "28306", population: 22000, median_income: 58000, median_home_value: 180000, marketing_value: 3, notes: "North"}
    ]
  },
  {
    city: "Fargo",
    state: "North Dakota",
    zip_codes: [
      {zip: "58102", population: 22000, median_income: 62000, median_home_value: 240000, marketing_value: 4, notes: "South Fargo"},
      {zip: "58103", population: 18000, median_income: 58000, median_home_value: 220000, marketing_value: 3, notes: "West"}
    ]
  },
  {
    city: "Bismarck",
    state: "North Dakota",
    zip_codes: [
      {zip: "58501", population: 18000, median_income: 62000, median_home_value: 260000, marketing_value: 4, notes: "Central"},
      {zip: "58503", population: 15000, median_income: 68000, median_home_value: 280000, marketing_value: 4, notes: "North"}
    ]
  },
  {
    city: "Cincinnati",
    state: "Ohio",
    zip_codes: [
      {zip: "45202", population: 12000, median_income: 52000, median_home_value: 220000, marketing_value: 3, notes: "Downtown"},
      {zip: "45208", population: 22000, median_income: 78000, median_home_value: 350000, marketing_value: 5, notes: "Hyde Park"}
    ]
  },
  {
    city: "Cleveland",
    state: "Ohio",
    zip_codes: [
      {zip: "44103", population: 48000, median_income: 38000, median_home_value: 125000, marketing_value: 1, notes: "East Cleveland area"},
      {zip: "44109", population: 45000, median_income: 42000, median_home_value: 145000, marketing_value: 1, notes: "West Side"},
      {zip: "44105", population: 52000, median_income: 48000, median_home_value: 175000, marketing_value: 2, notes: "Southeast"},
      {zip: "44113", population: 32000, median_income: 72000, median_home_value: 350000, marketing_value: 3, notes: "Tremont, gentrifying"}
    ]
  },
  {
    city: "Akron",
    state: "Ohio",
    zip_codes: [
      {zip: "44301", population: 15000, median_income: 42000, median_home_value: 140000, marketing_value: 2, notes: "Downtown"},
      {zip: "44313", population: 25000, median_income: 68000, median_home_value: 220000, marketing_value: 4, notes: "West Akron"}
    ]
  },
  {
    city: "Norman",
    state: "Oklahoma",
    zip_codes: [
      {zip: "73069", population: 28000, median_income: 58000, median_home_value: 220000, marketing_value: 4, notes: "Central"},
      {zip: "73072", population: 25000, median_income: 65000, median_home_value: 250000, marketing_value: 4, notes: "East Norman"}
    ]
  },
  {
    city: "Eugene",
    state: "Oregon",
    zip_codes: [
      {zip: "97401", population: 22000, median_income: 52000, median_home_value: 380000, marketing_value: 3, notes: "Downtown"},
      {zip: "97405", population: 28000, median_income: 68000, median_home_value: 450000, marketing_value: 4, notes: "South Eugene"}
    ]
  },
  {
    city: "Salem",
    state: "Oregon",
    zip_codes: [
      {zip: "97301", population: 18000, median_income: 48000, median_home_value: 280000, marketing_value: 3, notes: "Central"},
      {zip: "97306", population: 25000, median_income: 58000, median_home_value: 320000, marketing_value: 3, notes: "South Salem"}
    ]
  },
  {
    city: "Allentown",
    state: "Pennsylvania",
    zip_codes: [
      {zip: "18102", population: 18000, median_income: 42000, median_home_value: 140000, marketing_value: 2, notes: "Central"},
      {zip: "18104", population: 22000, median_income: 58000, median_home_value: 180000, marketing_value: 3, notes: "West side"}
    ]
  },
  {
    city: "Providence",
    state: "Rhode Island",
    zip_codes: [
      {zip: "02903", population: 15000, median_income: 48000, median_home_value: 280000, marketing_value: 3, notes: "Downtown"},
      {zip: "02906", population: 22000, median_income: 68000, median_home_value: 380000, marketing_value: 4, notes: "East Side"}
    ]
  },
  {
    city: "Columbia",
    state: "South Carolina",
    zip_codes: [
      {zip: "29201", population: 12000, median_income: 42000, median_home_value: 160000, marketing_value: 2, notes: "Downtown"},
      {zip: "29229", population: 28000, median_income: 72000, median_home_value: 260000, marketing_value: 4, notes: "Northeast"}
    ]
  },
  {
    city: "Charleston",
    state: "South Carolina",
    zip_codes: [
      {zip: "29401", population: 18000, median_income: 65000, median_home_value: 520000, marketing_value: 5, notes: "Historic downtown"},
      {zip: "29414", population: 32000, median_income: 78000, median_home_value: 420000, marketing_value: 5, notes: "West Ashley"}
    ]
  },
  {
    city: "North Charleston",
    state: "South Carolina",
    zip_codes: [
      {zip: "29405", population: 25000, median_income: 48000, median_home_value: 200000, marketing_value: 3, notes: "Central"},
      {zip: "29420", population: 28000, median_income: 58000, median_home_value: 240000, marketing_value: 3, notes: "North area"}
    ]
  },
  {
    city: "Sioux Falls",
    state: "South Dakota",
    zip_codes: [
      {zip: "57103", population: 25000, median_income: 62000, median_home_value: 240000, marketing_value: 4, notes: "Southwest"},
      {zip: "57106", population: 28000, median_income: 72000, median_home_value: 280000, marketing_value: 4, notes: "Southeast"}
    ]
  },
  {
    city: "Rapid City",
    state: "South Dakota",
    zip_codes: [
      {zip: "57701", population: 22000, median_income: 58000, median_home_value: 260000, marketing_value: 3, notes: "Central"},
      {zip: "57702", population: 18000, median_income: 62000, median_home_value: 280000, marketing_value: 4, notes: "West"}
    ]
  },
  {
    city: "Knoxville",
    state: "Tennessee",
    zip_codes: [
      {zip: "37902", population: 12000, median_income: 42000, median_home_value: 180000, marketing_value: 3, notes: "Downtown"},
      {zip: "37919", population: 28000, median_income: 72000, median_home_value: 320000, marketing_value: 5, notes: "West Knoxville"}
    ]
  },
  {
    city: "Chattanooga",
    state: "Tennessee",
    zip_codes: [
      {zip: "37402", population: 15000, median_income: 48000, median_home_value: 200000, marketing_value: 3, notes: "Downtown"},
      {zip: "37421", population: 28000, median_income: 68000, median_home_value: 260000, marketing_value: 4, notes: "East Brainerd"}
    ]
  },
  {
    city: "Irving",
    state: "Texas",
    zip_codes: [
      {zip: "75038", population: 32000, median_income: 68000, median_home_value: 240000, marketing_value: 4, notes: "Central"},
      {zip: "75063", population: 28000, median_income: 72000, median_home_value: 280000, marketing_value: 4, notes: "Las Colinas"}
    ]
  },
  {
    city: "Houston",
    state: "Texas",
    zip_codes: [
      {zip: "77002", population: 10000, median_income: 110000, median_home_value: 550000, marketing_value: 4, notes: "Downtown Houston"},
      {zip: "77098", population: 48000, median_income: 48000, median_home_value: 220000, marketing_value: 1, notes: "West Houston"}
    ]
  },
  {
    city: "Salt Lake City",
    state: "Utah",
    zip_codes: [
      {zip: "84101", population: 15000, median_income: 55000, median_home_value: 420000, marketing_value: 4, notes: "Downtown"},
      {zip: "84108", population: 28000, median_income: 92000, median_home_value: 680000, marketing_value: 5, notes: "Foothill area"}
    ]
  },
  {
    city: "West Valley City",
    state: "Utah",
    zip_codes: [
      {zip: "84119", population: 32000, median_income: 52000, median_home_value: 280000, marketing_value: 3, notes: "Central"},
      {zip: "84120", population: 28000, median_income: 58000, median_home_value: 310000, marketing_value: 3, notes: "Southwest"}
    ]
  },
  {
    city: "Provo",
    state: "Utah",
    zip_codes: [
      {zip: "84601", population: 25000, median_income: 48000, median_home_value: 350000, marketing_value: 3, notes: "Central"},
      {zip: "84604", population: 22000, median_income: 52000, median_home_value: 380000, marketing_value: 4, notes: "East bench"}
    ]
  },
  {
    city: "Burlington",
    state: "Vermont",
    zip_codes: [
      {zip: "05401", population: 18000, median_income: 58000, median_home_value: 420000, marketing_value: 4, notes: "Downtown"},
      {zip: "05408", population: 15000, median_income: 52000, median_home_value: 380000, marketing_value: 3, notes: "North end"}
    ]
  },
  {
    city: "Norfolk",
    state: "Virginia",
    zip_codes: [
      {zip: "23502", population: 22000, median_income: 52000, median_home_value: 180000, marketing_value: 3, notes: "East side"},
      {zip: "23518", population: 25000, median_income: 68000, median_home_value: 240000, marketing_value: 4, notes: "Ocean View"}
    ]
  },
  {
    city: "Richmond",
    state: "Virginia",
    zip_codes: [
      {zip: "23220", population: 18000, median_income: 48000, median_home_value: 240000, marketing_value: 3, notes: "Fan District"},
      {zip: "23238", population: 28000, median_income: 85000, median_home_value: 420000, marketing_value: 5, notes: "West End"}
    ]
  },
  {
    city: "Spokane",
    state: "Washington",
    zip_codes: [
      {zip: "99201", population: 12000, median_income: 42000, median_home_value: 240000, marketing_value: 3, notes: "Downtown"},
      {zip: "99223", population: 28000, median_income: 72000, median_home_value: 380000, marketing_value: 5, notes: "South Hill"}
    ]
  },
  {
    city: "Tacoma",
    state: "Washington",
    zip_codes: [
      {zip: "98402", population: 15000, median_income: 52000, median_home_value: 380000, marketing_value: 3, notes: "Downtown"},
      {zip: "98466", population: 28000, median_income: 78000, median_home_value: 520000, marketing_value: 5, notes: "University Place"}
    ]
  },
  {
    city: "Charleston",
    state: "West Virginia",
    zip_codes: [
      {zip: "25301", population: 15000, median_income: 42000, median_home_value: 140000, marketing_value: 2, notes: "Downtown"},
      {zip: "25314", population: 18000, median_income: 58000, median_home_value: 180000, marketing_value: 3, notes: "East side"}
    ]
  },
  {
    city: "Huntington",
    state: "West Virginia",
    zip_codes: [
      {zip: "25701", population: 12000, median_income: 38000, median_home_value: 120000, marketing_value: 2, notes: "Downtown"},
      {zip: "25705", population: 15000, median_income: 52000, median_home_value: 160000, marketing_value: 3, notes: "West side"}
    ]
  },
  {
    city: "Green Bay",
    state: "Wisconsin",
    zip_codes: [
      {zip: "54301", population: 18000, median_income: 52000, median_home_value: 180000, marketing_value: 3, notes: "East side"},
      {zip: "54313", population: 25000, median_income: 68000, median_home_value: 240000, marketing_value: 4, notes: "Southwest"}
    ]
  },
  {
    city: "Cheyenne",
    state: "Wyoming",
    zip_codes: [
      {zip: "82001", population: 18000, median_income: 58000, median_home_value: 260000, marketing_value: 3, notes: "Central"},
      {zip: "82009", population: 22000, median_income: 68000, median_home_value: 310000, marketing_value: 4, notes: "South Cheyenne"}
    ]
  },
  {
    city: "Casper",
    state: "Wyoming",
    zip_codes: [
      {zip: "82601", population: 22000, median_income: 62000, median_home_value: 240000, marketing_value: 3, notes: "Central"},
      {zip: "82604", population: 18000, median_income: 58000, median_home_value: 220000, marketing_value: 3, notes: "East side"}
    ]
  },
  {
    city: "New York",
    state: "New York",
    zip_codes: [
      {zip: "10001", population: 28000, median_income: 85000, median_home_value: 950000, marketing_value: 4, notes: "Midtown Manhattan"},
      {zip: "10002", population: 75000, median_income: 45000, median_home_value: 700000, marketing_value: 2, notes: "Lower East Side"}
    ]
  },
  {
    city: "Los Angeles",
    state: "California",
    zip_codes: [
      {zip: "90001", population: 62000, median_income: 32000, median_home_value: 450000, marketing_value: 1, notes: "South Central LA"},
      {zip: "90210", population: 25000, median_income: 150000, median_home_value: 2500000, marketing_value: 5, notes: "Beverly Hills"}
    ]
  },
  {
    city: "Chicago",
    state: "Illinois",
    zip_codes: [
      {zip: "60601", population: 15000, median_income: 90000, median_home_value: 600000, marketing_value: 3, notes: "Downtown Chicago"},
      {zip: "60613", population: 55000, median_income: 60000, median_home_value: 400000, marketing_value: 2, notes: "Lakeview"}
    ]
  }
];

export function findCityByZip(zipCode: string): { city: string; state: string } | null {
  for (const cityData of zipCodeData) {
    const found = cityData.zip_codes.find(zc => zc.zip === zipCode);
    if (found) {
      return { city: cityData.city, state: cityData.state };
    }
  }
  return null;
}
