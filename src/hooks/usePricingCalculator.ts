import { useState, useMemo, useCallback } from 'react';
import { ARIZONA_CITIES, CityPricingData, getPremiumCities } from '@/data/arizonaCityPricing';
import { REGIONAL_PACKAGES, RegionalPackage, getPackageCities } from '@/data/arizonaPackages';

export type SelectionMode = 'package' | 'build-your-own';

export interface PricingCalculatorState {
  mode: SelectionMode;
  selectedPackageIds: string[]; // Changed to array for multiple packages
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
  selectedPackages: RegionalPackage[]; // Changed to array
  
  // All city IDs that are covered by selected packages (for filtering)
  packageCoveredCityIds: string[];
  
  // Line items for display
  lineItems: Array<{
    type: 'package' | 'premium' | 'city';
    label: string;
    price: number;
    retailPrice: number;
    cityId?: string;
    packageId?: string;
  }>;
  
  // Actions
  setMode: (mode: SelectionMode) => void;
  togglePackage: (packageId: string) => void; // Changed from selectPackage
  togglePremiumCity: (cityId: string) => void;
  toggleAlaCarteCity: (cityId: string) => void;
  removeCity: (cityId: string) => void;
  removePackage: (packageId: string) => void;
  clearAll: () => void;
  
  // Smart suggestions
  suggestions: Array<{
    cityId: string;
    cityName: string;
    reason: string;
  }>;
  
  // Legacy compatibility
  selectedPackage: RegionalPackage | null;
  selectPackage: (packageId: string | null) => void;
}

export function usePricingCalculator(): PricingCalculatorResult {
  const [state, setState] = useState<PricingCalculatorState>({
    mode: 'package',
    selectedPackageIds: [],
    selectedPremiumCityIds: [],
    selectedAlaCarte: [],
  });

  // Set selection mode
  const setMode = useCallback((mode: SelectionMode) => {
    setState(prev => ({
      ...prev,
      mode,
      selectedAlaCarte: mode === 'package' ? [] : prev.selectedAlaCarte,
    }));
  }, []);

  // Toggle package selection (multi-select)
  const togglePackage = useCallback((packageId: string) => {
    setState(prev => {
      const isSelected = prev.selectedPackageIds.includes(packageId);
      const newPackageIds = isSelected
        ? prev.selectedPackageIds.filter(id => id !== packageId)
        : [...prev.selectedPackageIds, packageId];
      
      // Get all cities covered by newly selected packages
      const coveredCityIds = newPackageIds.flatMap(pkgId => {
        const pkg = REGIONAL_PACKAGES.find(p => p.id === pkgId);
        return pkg?.includedCityIds || [];
      });
      
      // Remove premium cities that are now covered by a package
      const filteredPremiumCities = prev.selectedPremiumCityIds.filter(
        cityId => !coveredCityIds.includes(cityId)
      );
      
      return {
        ...prev,
        mode: 'package',
        selectedPackageIds: newPackageIds,
        selectedPremiumCityIds: filteredPremiumCities,
      };
    });
  }, []);

  // Legacy selectPackage for compatibility (toggles a single package)
  const selectPackage = useCallback((packageId: string | null) => {
    if (packageId === null) {
      setState(prev => ({ ...prev, selectedPackageIds: [] }));
    } else {
      togglePackage(packageId);
    }
  }, [togglePackage]);

  // Remove a package
  const removePackage = useCallback((packageId: string) => {
    setState(prev => ({
      ...prev,
      selectedPackageIds: prev.selectedPackageIds.filter(id => id !== packageId),
    }));
  }, []);

  // Toggle premium city
  const togglePremiumCity = useCallback((cityId: string) => {
    setState(prev => {
      // Don't allow selecting premium cities that are already in a selected package
      const packageCoveredIds = prev.selectedPackageIds.flatMap(pkgId => {
        const pkg = REGIONAL_PACKAGES.find(p => p.id === pkgId);
        return pkg?.includedCityIds || [];
      });
      
      if (packageCoveredIds.includes(cityId)) {
        return prev; // City already in package, don't toggle
      }
      
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
      // Don't allow selecting cities that are already in a selected package
      const packageCoveredIds = prev.selectedPackageIds.flatMap(pkgId => {
        const pkg = REGIONAL_PACKAGES.find(p => p.id === pkgId);
        return pkg?.includedCityIds || [];
      });
      
      if (packageCoveredIds.includes(cityId)) {
        return prev; // City already in package, don't toggle
      }
      
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
      selectedPackageIds: [],
      selectedPremiumCityIds: [],
      selectedAlaCarte: [],
    });
  }, []);

  // Get selected packages
  const selectedPackages = useMemo(() => {
    return state.selectedPackageIds
      .map(id => REGIONAL_PACKAGES.find(p => p.id === id))
      .filter((p): p is RegionalPackage => p !== undefined);
  }, [state.selectedPackageIds]);

  // Legacy selectedPackage (first selected package or null)
  const selectedPackage = useMemo(() => {
    return selectedPackages.length > 0 ? selectedPackages[0] : null;
  }, [selectedPackages]);

  // All city IDs covered by selected packages
  const packageCoveredCityIds = useMemo(() => {
    return selectedPackages.flatMap(pkg => pkg.includedCityIds);
  }, [selectedPackages]);

  // Build line items
  const lineItems = useMemo(() => {
    const items: PricingCalculatorResult['lineItems'] = [];

    // Package line items
    selectedPackages.forEach(pkg => {
      items.push({
        type: 'package',
        label: pkg.name,
        price: pkg.earlyAdopterPrice,
        retailPrice: pkg.retailTotal,
        packageId: pkg.id,
      });
    });

    // Premium city line items (excluding those in packages)
    state.selectedPremiumCityIds.forEach(cityId => {
      if (!packageCoveredCityIds.includes(cityId)) {
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
      }
    });

    // À la carte line items (only in build-your-own mode)
    if (state.mode === 'build-your-own') {
      state.selectedAlaCarte.forEach(cityId => {
        if (!packageCoveredCityIds.includes(cityId)) {
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
        }
      });
    }

    return items;
  }, [selectedPackages, state.selectedPremiumCityIds, state.selectedAlaCarte, state.mode, packageCoveredCityIds]);

  // Calculate totals
  const { monthlyTotal, retailTotal, totalSavings, cityCount, selectedCities } = useMemo(() => {
    let monthly = 0;
    let retail = 0;
    const cities: CityPricingData[] = [];
    const addedCityIds = new Set<string>();

    // Package contributions
    selectedPackages.forEach(pkg => {
      monthly += pkg.earlyAdopterPrice;
      retail += pkg.retailTotal;
      const packageCities = getPackageCities(pkg.id);
      packageCities.forEach(city => {
        if (!addedCityIds.has(city.id)) {
          cities.push(city);
          addedCityIds.add(city.id);
        }
      });
    });

    // Premium cities (not in packages)
    state.selectedPremiumCityIds.forEach(cityId => {
      if (!addedCityIds.has(cityId)) {
        const city = ARIZONA_CITIES.find(c => c.id === cityId);
        if (city) {
          monthly += city.earlyAdopterPrice;
          retail += city.retailPrice;
          cities.push(city);
          addedCityIds.add(cityId);
        }
      }
    });

    // À la carte (only in build-your-own mode)
    if (state.mode === 'build-your-own') {
      state.selectedAlaCarte.forEach(cityId => {
        if (!addedCityIds.has(cityId)) {
          const city = ARIZONA_CITIES.find(c => c.id === cityId);
          if (city) {
            monthly += city.earlyAdopterPrice;
            retail += city.retailPrice;
            cities.push(city);
            addedCityIds.add(cityId);
          }
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
  }, [selectedPackages, state.selectedPremiumCityIds, state.selectedAlaCarte, state.mode]);

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

    // Suggest premium cities if they have packages but no premium add-ons
    if (selectedPackages.length > 0 && state.selectedPremiumCityIds.length === 0) {
      const premiumCities = getPremiumCities();
      const availablePremium = premiumCities.filter(c => !packageCoveredCityIds.includes(c.id));
      if (availablePremium.length > 0) {
        suggestions.push({
          cityId: availablePremium[0].id,
          cityName: availablePremium[0].cityName,
          reason: 'Add premium market for luxury buyers',
        });
      }
    }

    return suggestions.slice(0, 2);
  }, [state, selectedPackages, packageCoveredCityIds]);

  return {
    state: {
      ...state,
      // For compatibility, expose selectedPackageId as first selected package
      selectedPackageId: state.selectedPackageIds[0] || null,
    } as any,
    monthlyTotal,
    retailTotal,
    totalSavings,
    cityCount,
    selectedCities,
    selectedPackage,
    selectedPackages,
    packageCoveredCityIds,
    lineItems,
    setMode,
    togglePackage,
    selectPackage,
    togglePremiumCity,
    toggleAlaCarteCity,
    removeCity,
    removePackage,
    clearAll,
    suggestions,
  };
}
