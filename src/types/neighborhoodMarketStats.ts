export interface NeighborhoodMarketStatsMetadata {
  generatedAt: string;
  neighborhoodName: string;
  cityArea: string;
  state: string;
  stateAbbrev: string;
  primaryZip: string;
  version: string;
}

export interface NeighborhoodMarketStats {
  medianHomePrice: number;
  medianHouseholdIncome: number;
  medianRent: number;
  daysOnMarket: number;
  pricePerSqFt: number;
  yearOverYearChange: number;
  inventoryLevel: 'Low' | 'Moderate' | 'High';
  marketType: "Seller's Market" | 'Balanced' | "Buyer's Market";
  averageHomeSize: number;
  homeownershipRate: number;
  rentToIncomeRatio: number;
  rentalVacancyRate: number;
  pctRenterOccupied: number;
  metadata: NeighborhoodMarketStatsMetadata;
}
