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
    "city": "New York",
    "state": "New York",
    "zip_codes": [
      {
        "zip": "10001",
        "population": 28000,
        "median_income": 85000,
        "median_home_value": 950000,
        "marketing_value": 4,
        "notes": "Midtown Manhattan"
      },
      {
        "zip": "10002",
        "population": 75000,
        "median_income": 45000,
        "median_home_value": 700000,
        "marketing_value": 2,
        "notes": "Lower East Side"
      }
    ]
  },
  {
    "city": "Los Angeles",
    "state": "California",
    "zip_codes": [
      {
        "zip": "90001",
        "population": 62000,
        "median_income": 32000,
        "median_home_value": 450000,
        "marketing_value": 1,
        "notes": "South Central LA"
      },
      {
        "zip": "90210",
        "population": 25000,
        "median_income": 150000,
        "median_home_value": 2500000,
        "marketing_value": 5,
        "notes": "Beverly Hills"
      }
    ]
  },
  {
    "city": "Chicago",
    "state": "Illinois",
    "zip_codes": [
      {
        "zip": "60601",
        "population": 15000,
        "median_income": 90000,
        "median_home_value": 600000,
        "marketing_value": 3,
        "notes": "Downtown Chicago"
      },
      {
        "zip": "60613",
        "population": 55000,
        "median_income": 60000,
        "median_home_value": 400000,
        "marketing_value": 2,
        "notes": "Lakeview"
      }
    ]
  },
  {
    "city": "Houston",
    "state": "Texas",
    "zip_codes": [
      {
        "zip": "77002",
        "population": 10000,
        "median_income": 110000,
        "median_home_value": 550000,
        "marketing_value": 4,
        "notes": "Downtown Houston"
      },
      {
        "zip": "77098",
        "population": 48000,
        "median_income": 48000,
        "median_home_value": 220000,
        "marketing_value": 1,
        "notes": "West Houston"
      }
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
