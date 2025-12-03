import { useState, useMemo, useCallback } from 'react';
import { ARIZONA_CITIES, CityPricingData, getPremiumCities } from '@/data/arizonaCityPricing';
import { REGIONAL_PACKAGES, RegionalPackage, getPackageCities } from '@/data/arizonaPackages';

export type SelectionMode = 'package' | 'build-your-own';

export interface PricingCalculatorState {
  mode: SelectionMode;
  selectedPackageId: string | null;
  selectedPremiumCityIds: string[];
  selectedAlaCarte: string[];
}

export interface PricingCalculatorResult {
  // State
  state: PricingCalculatorState;
  
  // Computed values
  monthlyTotal: number;
  retailTotal: number;
  totalSavings: number;
  cityCount: number;
  selectedCities: CityPricingData[];
  selectedPackage: RegionalPackage | null;
  
  // Line items for display
  lineItems: Array<{
    type: 'package' | 'premium' | 'city';
    label: string;
    price: number;
    retailPrice: number;
    cityId?: string;
  }>;
  
  // Actions
  setMode: (mode: SelectionMode) => void;
  selectPackage: (packageId: string | null) => void;
  togglePremiumCity: (cityId: string) => void;
  toggleAlaCarteCity: (cityId: string) => void;
  removeCity: (cityId: string) => void;
  clearAll: () => void;
  
  // Smart suggestions
  suggestions: Array<{
    cityId: string;
    cityName: string;
    reason: string;
  }>;
}

export function usePricingCalculator(): PricingCalculatorResult {
  const [state, setState] = useState<PricingCalculatorState>({
    mode: 'package',
    selectedPackageId: null,
    selectedPremiumCityIds: [],
    selectedAlaCarte: [],
  });

  // Set selection mode
  const setMode = useCallback((mode: SelectionMode) => {
    setState(prev => ({
      ...prev,
      mode,
      selectedPackageId: mode === 'build-your-own' ? null : prev.selectedPackageId,
      selectedAlaCarte: mode === 'package' ? [] : prev.selectedAlaCarte,
    }));
  }, []);

  // Select a package
  const selectPackage = useCallback((packageId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedPackageId: packageId,
      mode: 'package',
    }));
  }, []);

  // Toggle premium city
  const togglePremiumCity = useCallback((cityId: string) => {
    setState(prev => {
      const isSelected = prev.selectedPremiumCityIds.includes(cityId);
      return {
        ...prev,
        selectedPremiumCityIds: isSelected
          ? prev.selectedPremiumCityIds.filter(id => id !== cityId)
          : [...prev.selectedPremiumCityIds, cityId],
      };
    });
  }, []);

  // Toggle à la carte city
  const toggleAlaCarteCity = useCallback((cityId: string) => {
    setState(prev => {
      const isSelected = prev.selectedAlaCarte.includes(cityId);
      return {
        ...prev,
        selectedAlaCarte: isSelected
          ? prev.selectedAlaCarte.filter(id => id !== cityId)
          : [...prev.selectedAlaCarte, cityId],
      };
    });
  }, []);

  // Remove city (from any selection)
  const removeCity = useCallback((cityId: string) => {
    setState(prev => ({
      ...prev,
      selectedPremiumCityIds: prev.selectedPremiumCityIds.filter(id => id !== cityId),
      selectedAlaCarte: prev.selectedAlaCarte.filter(id => id !== cityId),
    }));
  }, []);

  // Clear all selections
  const clearAll = useCallback(() => {
    setState({
      mode: 'package',
      selectedPackageId: null,
      selectedPremiumCityIds: [],
      selectedAlaCarte: [],
    });
  }, []);

  // Get selected package
  const selectedPackage = useMemo(() => {
    if (!state.selectedPackageId) return null;
    return REGIONAL_PACKAGES.find(p => p.id === state.selectedPackageId) || null;
  }, [state.selectedPackageId]);

  // Build line items
  const lineItems = useMemo(() => {
    const items: PricingCalculatorResult['lineItems'] = [];

    // Package line item
    if (selectedPackage) {
      items.push({
        type: 'package',
        label: selectedPackage.name,
        price: selectedPackage.earlyAdopterPrice,
        retailPrice: selectedPackage.retailTotal,
      });
    }

    // Premium city line items
    state.selectedPremiumCityIds.forEach(cityId => {
      const city = ARIZONA_CITIES.find(c => c.id === cityId);
      if (city) {
        items.push({
          type: 'premium',
          label: city.cityName,
          price: city.earlyAdopterPrice,
          retailPrice: city.retailPrice,
          cityId: city.id,
        });
      }
    });

    // À la carte line items (only in build-your-own mode)
    if (state.mode === 'build-your-own') {
      state.selectedAlaCarte.forEach(cityId => {
        const city = ARIZONA_CITIES.find(c => c.id === cityId);
        if (city) {
          items.push({
            type: 'city',
            label: city.cityName,
            price: city.earlyAdopterPrice,
            retailPrice: city.retailPrice,
            cityId: city.id,
          });
        }
      });
    }

    return items;
  }, [selectedPackage, state.selectedPremiumCityIds, state.selectedAlaCarte, state.mode]);

  // Calculate totals
  const { monthlyTotal, retailTotal, totalSavings, cityCount, selectedCities } = useMemo(() => {
    let monthly = 0;
    let retail = 0;
    const cities: CityPricingData[] = [];

    // Package contribution
    if (selectedPackage) {
      monthly += selectedPackage.earlyAdopterPrice;
      retail += selectedPackage.retailTotal;
      cities.push(...getPackageCities(selectedPackage.id));
    }

    // Premium cities
    state.selectedPremiumCityIds.forEach(cityId => {
      const city = ARIZONA_CITIES.find(c => c.id === cityId);
      if (city) {
        monthly += city.earlyAdopterPrice;
        retail += city.retailPrice;
        cities.push(city);
      }
    });

    // À la carte (only in build-your-own mode)
    if (state.mode === 'build-your-own') {
      state.selectedAlaCarte.forEach(cityId => {
        const city = ARIZONA_CITIES.find(c => c.id === cityId);
        if (city && !cities.some(c => c.id === cityId)) {
          monthly += city.earlyAdopterPrice;
          retail += city.retailPrice;
          cities.push(city);
        }
      });
    }

    return {
      monthlyTotal: monthly,
      retailTotal: retail,
      totalSavings: retail - monthly,
      cityCount: cities.length,
      selectedCities: cities,
    };
  }, [selectedPackage, state.selectedPremiumCityIds, state.selectedAlaCarte, state.mode]);

  // Smart suggestions
  const suggestions = useMemo(() => {
    const suggestions: PricingCalculatorResult['suggestions'] = [];
    
    // If they have East Valley cities but not Gilbert
    if (state.mode === 'build-your-own') {
      const hasEastValley = state.selectedAlaCarte.some(id => 
        ['mesa', 'chandler', 'tempe'].includes(id)
      );
      const hasGilbert = state.selectedAlaCarte.includes('gilbert');
      
      if (hasEastValley && !hasGilbert) {
        suggestions.push({
          cityId: 'gilbert',
          cityName: 'Gilbert',
          reason: 'Complete your East Valley coverage',
        });
      }
    }

    // Suggest premium cities if they have a package
    if (selectedPackage && state.selectedPremiumCityIds.length === 0) {
      const premiumCities = getPremiumCities();
      if (premiumCities.length > 0) {
        suggestions.push({
          cityId: premiumCities[0].id,
          cityName: premiumCities[0].cityName,
          reason: 'Add premium market for luxury buyers',
        });
      }
    }

    return suggestions.slice(0, 2);
  }, [state, selectedPackage]);

  return {
    state,
    monthlyTotal,
    retailTotal,
    totalSavings,
    cityCount,
    selectedCities,
    selectedPackage,
    lineItems,
    setMode,
    selectPackage,
    togglePremiumCity,
    toggleAlaCarteCity,
    removeCity,
    clearAll,
    suggestions,
  };
}
